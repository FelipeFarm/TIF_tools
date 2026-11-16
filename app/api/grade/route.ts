// Webflow Cloud requires API routes to run on the Edge runtime.
export const runtime = "edge";

type Status = "pass" | "warn" | "fail";
interface Check {
  id: string;
  category: "SEO" | "Mobile" | "Speed" | "Security" | "Social";
  title: string;
  status: Status;
  detail: string;
  weight: number;
}

const UA = "Mozilla/5.0 (compatible; TheIdeaFarmGrader/1.0; +https://theideafarm.net)";
const MAX_HTML = 3_000_000;

/** Block internal / private hosts so the grader can't be used to probe networks. */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (!h.includes(".") && !h.includes(":")) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (h.includes(":")) return true; // skip raw IPv6 entirely
  return false;
}

function normalizeUrl(input: string): URL | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    if (u.username || u.password) return null;
    if (u.port && !["80", "443"].includes(u.port)) return null;
    if (isBlockedHost(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

async function timedFetch(url: string, ms: number, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": UA, ...(init.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function metaContent(html: string, attr: "name" | "property", key: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const k = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"));
    if (k && k[1].toLowerCase() === key.toLowerCase()) {
      const c = tag.match(/content\s*=\s*["']([^"']*)["']/i);
      return c ? decode(c[1]) : "";
    }
  }
  return null;
}

function analyze(html: string, finalUrl: URL, ms: number, extras: { robots: boolean; sitemap: boolean }): Check[] {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // Strip scripts/styles for content checks
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");

  // Security
  add({
    id: "https",
    category: "Security",
    title: "Secure connection (HTTPS)",
    status: finalUrl.protocol === "https:" ? "pass" : "fail",
    detail:
      finalUrl.protocol === "https:"
        ? "Your site loads over HTTPS."
        : "Your site isn't using HTTPS. Browsers show a 'Not secure' warning, and Google ranks it lower.",
    weight: 12,
  });

  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decode(titleMatch[1]) : "";
  add({
    id: "title",
    category: "SEO",
    title: "Page title",
    status: !title ? "fail" : title.length < 25 || title.length > 65 ? "warn" : "pass",
    detail: !title
      ? "No page title found. This is the blue link people click in Google."
      : `"${title.slice(0, 90)}" (${title.length} characters). ${
          title.length < 25 ? "A bit short. Aim for 30–60 characters with your main service and city." : title.length > 65 ? "Too long, Google will cut it off. Aim for 30–60 characters." : "Good length."
        }`,
    weight: 10,
  });

  // Meta description
  const desc = metaContent(html, "name", "description");
  add({
    id: "description",
    category: "SEO",
    title: "Meta description",
    status: !desc ? "fail" : desc.length < 70 || desc.length > 170 ? "warn" : "pass",
    detail: !desc
      ? "No meta description. Google will guess the snippet under your link, which usually hurts clicks."
      : `${desc.length} characters. ${desc.length < 70 ? "Too short. Aim for 120–160 characters that sell the click." : desc.length > 170 ? "Too long, it'll be cut off. Aim for 120–160 characters." : "Good length."}`,
    weight: 8,
  });

  // H1
  const h1s = (body.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []).map((h) => decode(h.replace(/<[^>]+>/g, "")));
  add({
    id: "h1",
    category: "SEO",
    title: "Main heading (H1)",
    status: h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warn",
    detail:
      h1s.length === 1
        ? `One H1 found: "${h1s[0].slice(0, 80)}".`
        : h1s.length === 0
          ? "No H1 heading. Every page should have one clear main heading that says what you do."
          : `${h1s.length} H1 headings found. Use one main H1 per page so Google knows the topic.`,
    weight: 7,
  });

  // Viewport
  const viewport = metaContent(html, "name", "viewport");
  add({
    id: "viewport",
    category: "Mobile",
    title: "Mobile-friendly setup",
    status: viewport && /width\s*=\s*device-width/i.test(viewport) ? "pass" : "fail",
    detail:
      viewport && /width\s*=\s*device-width/i.test(viewport)
        ? "The page is set up to scale on phones."
        : "Missing the mobile viewport tag. On phones the page may show tiny, zoomed-out text.",
    weight: 10,
  });

  // Speed: server response time
  add({
    id: "response",
    category: "Speed",
    title: "Server response time",
    status: ms < 800 ? "pass" : ms < 1800 ? "warn" : "fail",
    detail: `The page responded in ${(ms / 1000).toFixed(2)}s. ${ms < 800 ? "Fast." : ms < 1800 ? "Okay, but could be faster. Aim for under 0.8s." : "Slow. Visitors start leaving after about 3 seconds."}`,
    weight: 9,
  });

  // Speed: HTML weight
  const kb = new TextEncoder().encode(html).length / 1024;
  add({
    id: "size",
    category: "Speed",
    title: "Page HTML size",
    status: kb < 150 ? "pass" : kb < 400 ? "warn" : "fail",
    detail: `${Math.round(kb)} KB of HTML. ${kb < 150 ? "Lean." : "Heavy HTML slows the first load, especially on mobile."}`,
    weight: 4,
  });

  // Images alt text
  const imgs = body.match(/<img\b[^>]*>/gi) || [];
  // alt="" is valid for decorative images, so only a missing alt attribute counts
  const missingAlt = imgs.filter((t) => !/\balt\s*=/i.test(t)).length;
  add({
    id: "alt",
    category: "SEO",
    title: "Image descriptions (alt text)",
    status: imgs.length === 0 || missingAlt === 0 ? "pass" : missingAlt / imgs.length > 0.3 ? "fail" : "warn",
    detail:
      imgs.length === 0
        ? "No images found on this page."
        : missingAlt === 0
          ? `All ${imgs.length} images have alt text.`
          : `${missingAlt} of ${imgs.length} images are missing alt text. That hurts accessibility and image search.`,
    weight: 5,
  });

  // Canonical
  const canonical = /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i.test(html);
  add({
    id: "canonical",
    category: "SEO",
    title: "Canonical tag",
    status: canonical ? "pass" : "warn",
    detail: canonical
      ? "Canonical tag found, which helps prevent duplicate-content issues."
      : "No canonical tag. Add one so Google knows the main version of each page.",
    weight: 3,
  });

  // Indexable
  const robotsMeta = metaContent(html, "name", "robots") || "";
  const noindex = /noindex/i.test(robotsMeta);
  add({
    id: "indexable",
    category: "SEO",
    title: "Visible to Google",
    status: noindex ? "fail" : "pass",
    detail: noindex
      ? "This page tells Google NOT to index it (noindex). It won't show up in search."
      : "The page allows search engines to index it.",
    weight: 10,
  });

  // Structured data
  const schema = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html);
  add({
    id: "schema",
    category: "SEO",
    title: "Structured data (schema)",
    status: schema ? "pass" : "warn",
    detail: schema
      ? "Structured data found. It helps Google show rich results like ratings, hours and FAQs."
      : "No structured data. Adding LocalBusiness / Organization schema helps you stand out in Google.",
    weight: 4,
  });

  // Open Graph
  const ogTitle = metaContent(html, "property", "og:title");
  const ogImage = metaContent(html, "property", "og:image");
  add({
    id: "og",
    category: "Social",
    title: "Social sharing preview",
    status: ogTitle && ogImage ? "pass" : ogTitle || ogImage ? "warn" : "fail",
    detail:
      ogTitle && ogImage
        ? "Open Graph title and image set, so links look good on Facebook, LinkedIn and texts."
        : "Missing Open Graph tags. Shared links may show no image or the wrong text.",
    weight: 3,
  });

  // Lang
  const lang = /<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html);
  add({
    id: "lang",
    category: "SEO",
    title: "Page language set",
    status: lang ? "pass" : "warn",
    detail: lang ? "The page declares its language." : "No language set on the page. It's a small fix that helps accessibility and SEO.",
    weight: 2,
  });

  // robots.txt + sitemap
  add({
    id: "sitemap",
    category: "SEO",
    title: "Sitemap & robots.txt",
    status: extras.sitemap && extras.robots ? "pass" : extras.sitemap || extras.robots ? "warn" : "fail",
    detail:
      extras.sitemap && extras.robots
        ? "Both robots.txt and sitemap.xml were found."
        : `${extras.robots ? "robots.txt found" : "No robots.txt"} · ${extras.sitemap ? "sitemap found" : "no sitemap.xml"}. A sitemap helps Google find all your pages.`,
    weight: 6,
  });

  return checks;
}

function grade(score: number) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export async function POST(req: Request) {
  let input = "";
  try {
    input = String((await req.json()).url ?? "");
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const url = normalizeUrl(input);
  if (!url) return Response.json({ error: "Please enter a valid public website address." }, { status: 400 });

  // Fetch the page, following redirects manually so every hop is checked
  let res: Response | null = null;
  let current = url;
  const start = Date.now();
  try {
    for (let hop = 0; hop < 5; hop++) {
      res = await timedFetch(current.toString(), 10_000, { redirect: "manual" });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        const next = normalizeUrl(new URL(res.headers.get("location")!, current).toString());
        if (!next) return Response.json({ error: "That site redirects somewhere we can't check." }, { status: 400 });
        current = next;
        continue;
      }
      break;
    }
  } catch {
    return Response.json(
      { error: "We couldn't reach that website. Check the address, or the site may be blocking automated checks." },
      { status: 502 }
    );
  }
  const ms = Date.now() - start;

  if (!res || !res.ok) {
    return Response.json(
      { error: `That page returned an error (${res?.status ?? "no response"}). Check the address and try again.` },
      { status: 502 }
    );
  }
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("html")) {
    return Response.json({ error: "That address doesn't look like a web page." }, { status: 400 });
  }
  const html = (await res.text()).slice(0, MAX_HTML);

  // robots.txt and sitemap.xml at the site root
  const origin = `${current.protocol}//${current.host}`;
  const getText = async (path: string) => {
    try {
      const r = await timedFetch(origin + path, 5000);
      return r.ok ? (await r.text()).slice(0, 20000) : "";
    } catch {
      return "";
    }
  };
  const [robotsTxt, sitemapXml] = await Promise.all([getText("/robots.txt"), getText("/sitemap.xml")]);
  const robots = /user-agent|sitemap|disallow|allow/i.test(robotsTxt);
  // Count a sitemap at /sitemap.xml, or one declared in robots.txt
  const sitemap = /<(urlset|sitemapindex)/i.test(sitemapXml) || /^\s*sitemap\s*:/im.test(robotsTxt);

  const checks = analyze(html, current, ms, { robots, sitemap });
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);
  const score = Math.round((earned / total) * 100);

  return Response.json({
    url: current.toString(),
    score,
    grade: grade(score),
    counts: {
      pass: checks.filter((c) => c.status === "pass").length,
      warn: checks.filter((c) => c.status === "warn").length,
      fail: checks.filter((c) => c.status === "fail").length,
    },
    checks: checks
      .sort((a, b) => ({ fail: 0, warn: 1, pass: 2 })[a.status] - ({ fail: 0, warn: 1, pass: 2 })[b.status] || b.weight - a.weight)
      .map(({ weight: _w, ...c }) => c),
  });
}
