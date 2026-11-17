import { analyzeHtml } from "./html";
import { runPsi, speedChecks } from "./psi";
import { findGbp, gbpCheck } from "./gbp";
import { GradeError, bareHost, normalizeUrl, timedFetch } from "./net";
import { CATEGORIES, type Check, type Report } from "./types";

const MAX_HTML = 3_000_000;

function letter(score: number) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

const earned = (cs: Check[]) => {
  const total = cs.reduce((s, c) => s + c.weight, 0);
  const got = cs.reduce((s, c) => s + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);
  return total ? Math.round((got / total) * 100) : 0;
};

async function fetchPage(url: URL) {
  let res: Response | null = null;
  let current = url;
  const start = Date.now();
  try {
    // Follow redirects manually so every hop is checked against the blocklist
    for (let hop = 0; hop < 5; hop++) {
      res = await timedFetch(current.toString(), 10_000, { redirect: "manual" });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = normalizeUrl(new URL(loc, current).toString());
        if (!next) throw new GradeError(`${url.hostname} redirects somewhere we can't check.`);
        current = next;
        continue;
      }
      break;
    }
  } catch (err) {
    if (err instanceof GradeError) throw err;
    throw new GradeError(`We couldn't reach ${url.hostname}. Check the address, or the site may be blocking automated checks.`, 502);
  }
  const ms = Date.now() - start;
  if (!res || !res.ok) throw new GradeError(`${url.hostname} returned an error (${res?.status ?? "no response"}). Check the address and try again.`, 502);
  if (!(res.headers.get("content-type") || "").includes("html")) throw new GradeError(`${url.hostname} doesn't look like a web page.`);
  return { html: (await res.text()).slice(0, MAX_HTML), finalUrl: current, ms };
}

export async function gradeSite(input: string, opts: { businessName?: string } = {}): Promise<Report> {
  const url = normalizeUrl(input);
  if (!url) throw new GradeError(`“${input.slice(0, 80)}” isn't a valid public website address.`);
  const key = process.env.GOOGLE_API_KEY || undefined;

  // Google's speed test is the slow part (10–40s), so start it first
  const psiPromise = runPsi(url.toString(), key);
  const desktopPromise = runPsi(url.toString(), key, "desktop");

  const { html, finalUrl, ms } = await fetchPage(url);
  const origin = `${finalUrl.protocol}//${finalUrl.host}`;
  const getText = async (path: string) => {
    try {
      const r = await timedFetch(origin + path, 5000);
      return r.ok ? (await r.text()).slice(0, 20000) : "";
    } catch {
      return "";
    }
  };
  const [robotsTxt, sitemapXml] = await Promise.all([getText("/robots.txt"), getText("/sitemap.xml")]);
  const { checks, meta } = analyzeHtml(html, {
    robots: /user-agent|sitemap|disallow|allow/i.test(robotsTxt),
    sitemap: /<(urlset|sitemapindex)/i.test(sitemapXml) || /^\s*sitemap\s*:/im.test(robotsTxt),
    responseMs: ms,
    https: finalUrl.protocol === "https:",
  });

  // Google Business Profile lookup (needs an API key with Places API (New) enabled)
  const userNamed = !!opts.businessName?.trim();
  const fallbackName = meta.schemaName ? `${meta.schemaName}${meta.schemaCity ? `, ${meta.schemaCity}` : ""}` : meta.siteName;
  const generic = /^(home|homepage|home page|welcome|index|untitled|main|default|site|website|page|official site)$/i;
  let query = (userNamed ? opts.businessName!.trim() : fallbackName).slice(0, 120);
  if (!userNamed && (query.length < 3 || generic.test(query.trim()))) {
    // Fall back to the domain name: "smith-plumbing.com" -> "smith plumbing"
    query = bareHost(finalUrl.hostname).split(".")[0].replace(/[-_]+/g, " ");
  }
  const gbpPromise = key ? findGbp(finalUrl.hostname, query, userNamed, key) : Promise.resolve(null);

  const [psi, gbp, desk] = await Promise.all([psiPromise, gbpPromise, desktopPromise]);
  if (psi.data) psi.data.desktop = desk.data ? { ...desk.data, field: null } : null;
  if (psi.data) checks.push(...speedChecks(psi.data));
  if (gbp) checks.push(gbpCheck(gbp));

  const score = earned(checks);
  const order = { fail: 0, warn: 1, pass: 2 } as const;
  return {
    url: finalUrl.toString(),
    host: bareHost(finalUrl.hostname),
    score,
    grade: letter(score),
    categories: CATEGORIES.map((name) => ({ name, cs: checks.filter((c) => c.category === name) }))
      .filter((c) => c.cs.length)
      .map(({ name, cs }) => ({ name, score: earned(cs) })),
    counts: {
      pass: checks.filter((c) => c.status === "pass").length,
      warn: checks.filter((c) => c.status === "warn").length,
      fail: checks.filter((c) => c.status === "fail").length,
    },
    checks: checks
      .sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight)
      .map(({ weight: _w, ...c }) => c),
    speed: psi.data,
    speedError: psi.data ? undefined : psi.error,
    gbp,
    gbpSkipped: !key || (key && !gbp) ? true : undefined,
  };
}
