import type { PageRecord } from "./types";
import { isInternal, resolveLink } from "./urls";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
};

function meta(html: string, key: string, by: "name" | "property" = "name"): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if ((attr(tag, by) || "").toLowerCase() === key) return decode(attr(tag, "content") || "");
  }
  return null;
}

/** FNV-1a hash of normalized body text, used to spot exact duplicate pages */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Extract everything the audit needs from one HTML page. */
export function parsePage(html: string, finalUrl: string, siteHost: string): Partial<PageRecord> {
  const baseTag = html.match(/<base\b[^>]*>/i);
  const base = (baseTag && resolveLink(attr(baseTag[0], "href") || "", finalUrl)) || finalUrl;
  const bodyAt = html.search(/<body\b/i);
  const head = html.slice(0, bodyAt > 0 ? bodyAt : 20000);
  // Content checks look at <body> only, so the <title> doesn't count as page text
  const body = (bodyAt > 0 ? html.slice(bodyAt) : html.replace(/<head\b[\s\S]*?<\/head>/i, " "))
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1s = (body.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []).map((h) => decode(h.replace(/<[^>]+>/g, " "))).filter(Boolean);
  const canonTag = (html.match(/<link\b[^>]*>/gi) || []).find((t) => /\brel\s*=\s*["']?canonical/i.test(t));
  const robots = (meta(html, "robots") || "").toLowerCase();

  // Visible text (rough): drop header/nav/footer chrome so menus don't count as content
  const main = body.replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, " ");
  const text = decode(main.replace(/<[^>]+>/g, " "));
  const words = text ? text.split(" ").filter((w) => /[a-z0-9]/i.test(w)).length : 0;

  const internal = new Map<string, boolean>();
  const external = new Set<string>();
  for (const tag of body.match(/<a\b[^>]*>/gi) || []) {
    const href = attr(tag, "href");
    if (!href) continue;
    const url = resolveLink(href, base);
    if (!url) continue;
    const nofollow = /\bnofollow\b/i.test(attr(tag, "rel") || "");
    if (isInternal(url, siteHost)) internal.set(url, (internal.get(url) ?? true) && nofollow);
    else external.add(url);
  }

  const images: { src: string; alt: boolean }[] = [];
  const seenImg = new Set<string>();
  for (const tag of body.match(/<img\b[^>]*>/gi) || []) {
    const raw = attr(tag, "src") || attr(tag, "data-src");
    const src = raw ? resolveLink(raw, base) : null;
    if (!src || seenImg.has(src)) continue;
    seenImg.add(src);
    images.push({ src, alt: attr(tag, "alt") !== null });
  }

  const mixed: string[] = [];
  if (finalUrl.startsWith("https:")) {
    const res = html.match(/<(img|script|iframe|source|video|audio|link)\b[^>]*>/gi) || [];
    for (const tag of res) {
      const isLink = /^<link/i.test(tag);
      if (isLink && !/\brel\s*=\s*["']?(stylesheet|preload|icon)/i.test(tag)) continue;
      const v = attr(tag, isLink ? "href" : "src");
      if (v && /^http:\/\//i.test(v.trim())) mixed.push(v.trim());
    }
  }

  return {
    title: titleM ? decode(titleM[1]) : "",
    description: meta(html, "description") ?? "",
    h1s,
    canonical: canonTag ? resolveLink(attr(canonTag, "href") || "", base) : null,
    noindex: /noindex/.test(robots),
    lang: /<html\b[^>]*\blang\s*=/i.test(html),
    viewport: /width\s*=\s*device-width/i.test(meta(head, "viewport") || meta(html, "viewport") || ""),
    hasSchema: /application\/ld\+json/i.test(html) || /\bitemtype\s*=/i.test(html),
    hasOg: !!meta(html, "og:title", "property") && !!meta(html, "og:image", "property"),
    words,
    textHash: words >= 50 ? hash(text.toLowerCase()) : undefined,
    internalLinks: [...internal].map(([url, nofollow]) => ({ url, nofollow })).slice(0, 400),
    externalLinks: [...external].slice(0, 200),
    images: images.slice(0, 200),
    mixed: [...new Set(mixed)].slice(0, 50),
  };
}
