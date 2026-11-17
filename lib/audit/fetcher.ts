import { normalizeUrl, timedFetch } from "@/lib/grader/net";
import { parsePage } from "./parse";
import { bare, isInternal, parseRobots, resolveLink } from "./urls";
import { MAX_SITEMAP_URLS } from "./config";
import type { LinkStatus, PageRecord, SiteInfo } from "./types";

const MAX_HTML = 3_000_000;

/** Bot-protection / challenge pages (Cloudflare, Sucuri, PerimeterX, DataDome, generic captcha walls) */
const CHALLENGE_TITLE = /^(client challenge|just a moment|attention required|access denied|security check|please wait|ddos protection|checking your browser|one more step|verify you are human|are you a robot|bot verification)/i;
const CHALLENGE_BODY = /(challenge-platform|cf-browser-verification|_cf_chl_|cf-chl-|sgcaptcha|px-captcha|captcha-delivery\.com|ddos-guard|sucuri_cloudproxy|incapsula incident|\/cdn-cgi\/challenge)/i;

export function isChallenge(html: string, title: string | undefined): boolean {
  return CHALLENGE_TITLE.test((title || "").trim()) || (html.length < 60_000 && CHALLENGE_BODY.test(html));
}

/** Fetch one page, following redirects by hand so each hop is recorded and checked. */
export async function fetchPage(input: string, siteHost: string, depth: number | null): Promise<PageRecord> {
  const rec: PageRecord = { url: input, finalUrl: input, status: 0, redirects: [], ms: 0, bytes: 0, isHtml: false, depth };
  const start = Date.now();
  let current = input;
  const seen = new Set<string>();
  try {
    for (let hop = 0; hop < 8; hop++) {
      const safe = normalizeUrl(current);
      if (!safe) {
        rec.error = "Redirects to an address we can't check";
        break;
      }
      if (seen.has(current)) {
        rec.loop = true;
        rec.error = "Redirect loop";
        break;
      }
      seen.add(current);
      const res = await timedFetch(current, 12_000, { redirect: "manual" });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        rec.redirects.push({ url: current, status: res.status });
        const next = resolveLink(loc, current);
        if (!next) {
          rec.status = res.status;
          break;
        }
        current = next;
        continue;
      }
      rec.status = res.status;
      rec.finalUrl = current;
      rec.ms = Date.now() - start;
      const ctype = res.headers.get("content-type") || "";
      rec.isHtml = ctype.includes("html");
      if (rec.isHtml && res.ok && isInternal(current, siteHost)) {
        const html = (await res.text()).slice(0, MAX_HTML);
        rec.bytes = new TextEncoder().encode(html).length;
        const parsed = parsePage(html, current, siteHost);
        if (isChallenge(html, parsed.title)) {
          // Don't judge the site on a bot-check page; keep only its links so the crawl can continue
          rec.challenge = true;
          rec.internalLinks = parsed.internalLinks;
        } else Object.assign(rec, parsed);
      } else {
        rec.bytes = Number(res.headers.get("content-length")) || 0;
        await res.body?.cancel().catch(() => {});
      }
      return rec;
    }
    if (!rec.error) rec.error = "Too many redirects";
  } catch {
    rec.error = "Timed out or could not connect";
  }
  rec.ms = Date.now() - start;
  return rec;
}

async function getText(url: string, ms = 8000): Promise<string | null> {
  try {
    const r = await timedFetch(url, ms);
    if (!r.ok) {
      await r.body?.cancel().catch(() => {});
      return null;
    }
    return (await r.text()).slice(0, 5_000_000);
  } catch {
    return null;
  }
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));

/** Resolve the site's real origin, then read robots.txt and sitemaps. */
export async function discover(input: string): Promise<SiteInfo> {
  const url = normalizeUrl(input);
  if (!url) throw new Error(`“${input.slice(0, 80)}” isn't a valid public website address.`);
  const home = await fetchPage(url.toString(), url.hostname, 0);
  if (!home.status || home.status >= 400) {
    throw new Error(
      home.status
        ? `${url.hostname} returned an error (${home.status}). Check the address and try again.`
        : `We couldn't reach ${url.hostname}. Check the address, or the site may be blocking automated checks.`
    );
  }
  const final = new URL(home.finalUrl);
  const origin = `${final.protocol}//${final.host}`;
  const host = bare(final.hostname);

  const robotsTxt = await getText(`${origin}/robots.txt`, 6000);
  const robotsFound = !!robotsTxt && /user-agent|disallow|allow|sitemap/i.test(robotsTxt);
  const robots = robotsFound ? parseRobots(robotsTxt!) : { disallow: [], sitemaps: [] };

  // Sitemaps: from robots.txt first, otherwise the usual locations
  const candidates = (robots.sitemaps.length ? robots.sitemaps : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`])
    .filter((s) => normalizeUrl(s))
    .slice(0, 3);
  const urls = new Set<string>();
  let found = false;
  for (const sm of candidates) {
    const xml = await getText(sm);
    if (!xml || !/<(urlset|sitemapindex)/i.test(xml)) continue;
    found = true;
    if (/<sitemapindex/i.test(xml)) {
      for (const child of locs(xml).filter((c) => normalizeUrl(c)).slice(0, 4)) {
        const cx = await getText(child);
        if (cx) locs(cx).forEach((u) => urls.add(u));
        if (urls.size >= MAX_SITEMAP_URLS) break;
      }
    } else locs(xml).forEach((u) => urls.add(u));
    if (urls.size >= MAX_SITEMAP_URLS || found) break;
  }

  return {
    origin,
    host,
    startUrl: home.finalUrl,
    robots: { found: robotsFound, disallow: robots.disallow.slice(0, 100), sitemaps: robots.sitemaps.slice(0, 10) },
    sitemap: {
      found,
      urls: [...urls]
        .map((u) => resolveLink(u, origin))
        .filter((u): u is string => !!u && isInternal(u, host))
        .slice(0, MAX_SITEMAP_URLS),
    },
    https: final.protocol === "https:",
  };
}

/** Status-check external links and images (HEAD, falling back to GET). */
export async function checkLink(url: string): Promise<LinkStatus> {
  if (!normalizeUrl(url)) return { url, status: -1 }; // not checkable (private host etc.)
  try {
    let res = await timedFetch(url, 8000, { method: "HEAD", redirect: "follow" });
    if ([403, 405, 501].includes(res.status) || res.status === 0) {
      res = await timedFetch(url, 8000, { method: "GET", redirect: "follow" });
      await res.body?.cancel().catch(() => {});
    }
    return { url, status: res.status };
  } catch {
    return { url, status: 0 };
  }
}

/** Run async jobs with limited concurrency. */
export async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}
