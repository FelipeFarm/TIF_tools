/** Pure URL helpers shared by the browser-side crawler and the server. */

export const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");

const TRACKING = /^(utm_[a-z]+|gclid|fbclid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|ref)$/i;
const NON_HTML = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|mp4|mov|webm|mp3|wav|zip|rar|docx?|xlsx?|pptx?|csv|txt|xml|json|css|js|woff2?|ttf|eot)$/i;

/** Resolve an href against a base URL; drop hash and tracking params. Returns null for non-web links. */
export function resolveLink(href: string, base: string): string | null {
  const h = href.trim();
  if (!h || /^(mailto:|tel:|sms:|javascript:|data:|#)/i.test(h)) return null;
  try {
    const u = new URL(h, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return null;
  }
}

export function isInternal(url: string, host: string): boolean {
  try {
    return bare(new URL(url).hostname) === bare(host);
  } catch {
    return false;
  }
}

export function looksLikeHtml(url: string): boolean {
  try {
    return !NON_HTML.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search || "/";
  } catch {
    return url;
  }
}

/** Parse robots.txt rules for User-agent: * */
export function parseRobots(txt: string): { disallow: string[]; sitemaps: string[] } {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  let applies = false;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "sitemap") {
      sitemaps.push(val);
      continue;
    }
    if (key === "user-agent") {
      // consecutive user-agent lines form one group
      applies = lastWasAgent ? applies || val === "*" : val === "*";
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (applies && key === "disallow" && val) disallow.push(val);
  }
  return { disallow, sitemaps };
}

/** Does a robots Disallow rule block this URL? Supports * and $ wildcards. */
export function isDisallowed(url: string, disallow: string[]): boolean {
  const p = pathOf(url);
  return disallow.some((rule) => {
    const re = new RegExp(
      "^" +
        rule
          .split("*")
          .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*")
          .replace(/\\\$$/, "$")
    );
    return re.test(p);
  });
}

/** Pagination URLs: ?page=2, ?p=3, Webflow's ?1304bda0_page=2, /page/2/ */
export function isPaginated(url: string): boolean {
  try {
    const u = new URL(url);
    if (/\/page\/\d+\/?$/i.test(u.pathname)) return true;
    for (const [k, v] of u.searchParams) if (/(^|[_-])(page|p|pg|paged)$/i.test(k) && /^\d+$/.test(v)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Compare URLs the way canonicals should be compared: ignore protocol, www, trailing slash and case of host */
export function sameUrl(a: string, b: string): boolean {
  const norm = (x: string) => {
    try {
      const u = new URL(x);
      return `${bare(u.hostname)}${u.pathname.replace(/\/+$/, "") || "/"}${u.search}`;
    } catch {
      return x;
    }
  };
  return norm(a) === norm(b);
}

/**
 * Rewrite a same-site URL onto the site's real origin (e.g. http://acme.com/x -> https://www.acme.com/x),
 * so www/non-www and http/https variants are crawled once. Other URLs are returned unchanged.
 */
export function toOrigin(url: string, origin: string): string {
  try {
    const u = new URL(url);
    const o = new URL(origin);
    if (bare(u.hostname) !== bare(o.hostname)) return url;
    u.protocol = o.protocol;
    u.host = o.host;
    return u.toString();
  } catch {
    return url;
  }
}

/** True when a same-site link uses a different host/protocol than the site's real origin (so it redirects) */
export function isOffOrigin(url: string, origin: string): boolean {
  try {
    const u = new URL(url);
    const o = new URL(origin);
    return bare(u.hostname) === bare(o.hostname) && (u.host !== o.host || u.protocol !== o.protocol);
  } catch {
    return false;
  }
}
