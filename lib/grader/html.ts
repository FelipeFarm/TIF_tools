import type { Check } from "./types";

export interface PageMeta {
  title: string;
  siteName: string;
  /** From LocalBusiness/Organization JSON-LD, if present */
  schemaName: string | null;
  schemaCity: string | null;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
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

/** Walk every JSON-LD block and collect objects (handles @graph and arrays). */
function jsonLdObjects(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const blocks = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      out.push(o);
      if (o["@graph"]) visit(o["@graph"]);
    }
  };
  for (const b of blocks) {
    const inner = b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      visit(JSON.parse(inner));
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

export interface Extras {
  robots: boolean;
  sitemap: boolean;
  responseMs: number;
  https: boolean;
}

export function analyzeHtml(html: string, extras: Extras): { checks: Check[]; meta: PageMeta } {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const text = decode(body.replace(/<[^>]+>/g, " "));

  /* ── Security ── */
  add({
    id: "https",
    category: "Security",
    title: "Secure connection (HTTPS)",
    status: extras.https ? "pass" : "fail",
    headline: extras.https ? "Secure" : "Not secure",
    detail: extras.https
      ? "Your site loads over HTTPS, so browsers show it as secure."
      : "Your site isn't using HTTPS. Chrome and Safari label it 'Not secure', which scares visitors off, and Google ranks it lower.",
    fix: extras.https
      ? ""
      : "Turn on SSL with your host (it's free on Webflow, Squarespace, Wix and most hosts), then force all traffic to https:// with a redirect.",
    weight: 12,
  });

  /* ── SEO basics ── */
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decode(titleMatch[1]) : "";
  add({
    id: "title",
    category: "SEO",
    title: "Page title",
    status: !title ? "fail" : title.length < 25 || title.length > 65 ? "warn" : "pass",
    headline: !title ? "Missing" : `${title.length} characters`,
    detail: !title
      ? "No page title found. The title is the blue link people click in Google results."
      : `Your title is "${title.slice(0, 90)}" (${title.length} characters).${
          title.length < 25 ? " That's short, so you're leaving keywords on the table." : title.length > 65 ? " Google cuts titles off at about 60 characters." : ""
        }`,
    fix:
      title && title.length >= 25 && title.length <= 65
        ? ""
        : "Write a 30–60 character title that leads with your main service and city, then your brand. Example: “Emergency Plumber in Katy, TX | Smith Plumbing”.",
    weight: 10,
  });

  const desc = metaContent(html, "name", "description");
  add({
    id: "description",
    category: "SEO",
    title: "Meta description",
    status: !desc ? "fail" : desc.length < 70 || desc.length > 170 ? "warn" : "pass",
    headline: !desc ? "Missing" : `${desc.length} characters`,
    detail: !desc
      ? "No meta description. Google will pull random text from the page for the snippet under your link, which usually hurts clicks."
      : `Your description is ${desc.length} characters.${desc.length < 70 ? " That's too short to sell the click." : desc.length > 170 ? " It'll be cut off in search results." : ""}`,
    fix:
      desc && desc.length >= 70 && desc.length <= 170
        ? ""
        : "Write a 120–160 character description that says what you do, where, and why to pick you, ending with a call to action. Example: “Licensed Katy plumbers, same-day service and upfront pricing. Call now for a free estimate.”",
    weight: 8,
  });

  const h1s = (body.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []).map((h) => decode(h.replace(/<[^>]+>/g, "")));
  add({
    id: "h1",
    category: "SEO",
    title: "Main heading (H1)",
    status: h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warn",
    headline: h1s.length === 1 ? "1 found" : h1s.length === 0 ? "Missing" : `${h1s.length} found`,
    detail:
      h1s.length === 1
        ? `Your main heading is "${h1s[0].slice(0, 80)}".`
        : h1s.length === 0
          ? "There's no H1 heading. Google uses it as a strong signal for what the page is about."
          : `There are ${h1s.length} H1 headings, which muddies the signal about the page's main topic.`,
    fix:
      h1s.length === 1
        ? ""
        : "Use exactly one H1 near the top of the page that states what you do and where (e.g. “Roof Repair & Replacement in Houston”). Turn other big headings into H2s.",
    weight: 7,
  });

  const imgs = body.match(/<img\b[^>]*>/gi) || [];
  const missingAlt = imgs.filter((t) => !/\balt\s*=/i.test(t)).length;
  add({
    id: "alt",
    category: "SEO",
    title: "Image descriptions (alt text)",
    status: imgs.length === 0 || missingAlt === 0 ? "pass" : missingAlt / imgs.length > 0.3 ? "fail" : "warn",
    headline: imgs.length === 0 ? "No images" : missingAlt === 0 ? `All ${imgs.length} set` : `${missingAlt} of ${imgs.length} missing`,
    detail:
      imgs.length === 0
        ? "No images were found on this page."
        : missingAlt === 0
          ? `All ${imgs.length} images have alt text.`
          : `${missingAlt} of ${imgs.length} images have no alt text. Screen readers can't describe them and Google Images can't index them.`,
    fix:
      missingAlt === 0
        ? ""
        : "Add a short, specific description to each image (e.g. “Technician repairing an AC unit in Sugar Land”). Purely decorative images can use an empty alt.",
    weight: 5,
  });

  const canonical = /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i.test(html);
  add({
    id: "canonical",
    category: "SEO",
    title: "Canonical tag",
    status: canonical ? "pass" : "warn",
    headline: canonical ? "Set" : "Missing",
    detail: canonical
      ? "A canonical tag tells Google which version of the page is the main one."
      : "There's no canonical tag, so Google may treat versions of your URL (with/without www, tracking parameters) as duplicates.",
    fix: canonical ? "" : "Add a self-referencing canonical tag to every page. In Webflow, set it in Site settings → SEO → Global canonical URL.",
    weight: 3,
  });

  const robotsMeta = metaContent(html, "name", "robots") || "";
  const noindex = /noindex/i.test(robotsMeta);
  add({
    id: "indexable",
    category: "SEO",
    title: "Visible to Google",
    status: noindex ? "fail" : "pass",
    headline: noindex ? "Blocked" : "Indexable",
    detail: noindex
      ? "This page tells Google NOT to index it (noindex). It will not show up in search results at all."
      : "The page allows search engines to index it.",
    fix: noindex ? "Remove the noindex robots tag. It's often left on by accident after a site launch." : "",
    weight: 10,
  });

  add({
    id: "sitemap",
    category: "SEO",
    title: "Sitemap & robots.txt",
    status: extras.sitemap && extras.robots ? "pass" : extras.sitemap || extras.robots ? "warn" : "fail",
    headline: extras.sitemap && extras.robots ? "Both found" : extras.sitemap ? "No robots.txt" : extras.robots ? "No sitemap" : "Both missing",
    detail:
      extras.sitemap && extras.robots
        ? "Both robots.txt and an XML sitemap were found, so Google can discover all your pages."
        : `${extras.robots ? "robots.txt was found" : "No robots.txt was found"} and ${extras.sitemap ? "a sitemap was found" : "no XML sitemap was found"}. Without a sitemap, new pages take longer to show up in Google.`,
    fix:
      extras.sitemap && extras.robots
        ? ""
        : "Generate an XML sitemap (Webflow, WordPress/Yoast and Squarespace can do it automatically), reference it in robots.txt, and submit it in Google Search Console.",
    weight: 6,
  });

  const lang = /<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html);
  add({
    id: "lang",
    category: "SEO",
    title: "Page language set",
    status: lang ? "pass" : "warn",
    headline: lang ? "Set" : "Missing",
    detail: lang ? "The page declares its language." : "The page doesn't declare its language.",
    fix: lang ? "" : "Add lang=\"en\" (or your language) to the <html> tag. It's a one-line fix that helps accessibility and search.",
    weight: 2,
  });

  /* ── Mobile ── */
  const viewport = metaContent(html, "name", "viewport");
  const vpOk = !!viewport && /width\s*=\s*device-width/i.test(viewport);
  add({
    id: "viewport",
    category: "Mobile",
    title: "Mobile-friendly setup",
    status: vpOk ? "pass" : "fail",
    headline: vpOk ? "Set up" : "Not set up",
    detail: vpOk
      ? "The page is set up to scale properly on phones."
      : "The mobile viewport tag is missing, so phones may show a tiny, zoomed-out desktop page. Most local searches happen on phones.",
    fix: vpOk ? "" : 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the page head, then check every section on a real phone.',
    weight: 10,
  });

  /* ── Speed (server side; Google speed test is added separately) ── */
  const ms = extras.responseMs;
  add({
    id: "response",
    category: "Speed",
    title: "Server response time",
    status: ms < 800 ? "pass" : ms < 1800 ? "warn" : "fail",
    headline: `${(ms / 1000).toFixed(2)}s`,
    detail: `Your server took ${(ms / 1000).toFixed(2)}s to send the page.${ms < 800 ? "" : " Everything else on the page waits for this."}`,
    fix: ms < 800 ? "" : "Move to faster hosting or add a CDN, enable caching, and trim heavy plugins or apps that run on every page load.",
    weight: 4,
  });

  /* ── Local ── */
  const objs = jsonLdObjects(html);
  const typeOf = (o: Record<string, unknown>) => ([] as unknown[]).concat(o["@type"] ?? []).map(String);
  const localObj = objs.find((o) => o.address || typeOf(o).some((t) => /LocalBusiness|Store|Dentist|Plumber|Attorney|Restaurant|Physician|HomeAndConstruction|Contractor|Agent/i.test(t)));
  const orgObj = localObj || objs.find((o) => typeOf(o).some((t) => /Organization|Corporation/i.test(t)));
  const addr = (localObj?.address ?? null) as Record<string, unknown> | null;
  add({
    id: "schema",
    category: "Local",
    title: "Business details for Google (schema)",
    status: localObj ? "pass" : objs.length ? "warn" : "fail",
    headline: localObj ? "LocalBusiness found" : objs.length ? "No local details" : "Missing",
    detail: localObj
      ? "Your page tells Google your business name and address in structured data, which supports your local rankings and rich results."
      : objs.length
        ? "The page has some structured data, but nothing that tells Google your business type, address or service area."
        : "The page has no structured data, so Google has to guess your business details.",
    fix: localObj
      ? ""
      : "Add LocalBusiness schema (or the closest type, like Dentist or Plumber) with your name, address, phone, hours and service area. Make sure it matches your Google Business Profile exactly.",
    weight: 4,
  });

  const telLink = /href\s*=\s*["']tel:/i.test(html);
  const phoneText = /(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(text);
  add({
    id: "phone",
    category: "Local",
    title: "Click-to-call phone number",
    status: telLink ? "pass" : phoneText ? "warn" : "fail",
    headline: telLink ? "Tap to call" : phoneText ? "Not clickable" : "Not found",
    detail: telLink
      ? "Visitors on phones can tap your number to call you."
      : phoneText
        ? "Your phone number is on the page, but it isn't a tap-to-call link, so mobile visitors have to copy it."
        : "We couldn't find a phone number on the homepage. For local businesses, calls are often the #1 lead source.",
    fix: telLink ? "" : "Put your phone number in the header and footer as a tel: link (e.g. <a href=\"tel:+17135551234\">). Use the same number as your Google Business Profile.",
    weight: 4,
  });

  /* ── Social ── */
  const ogTitle = metaContent(html, "property", "og:title");
  const ogImage = metaContent(html, "property", "og:image");
  add({
    id: "og",
    category: "Social",
    title: "Social sharing preview",
    status: ogTitle && ogImage ? "pass" : ogTitle || ogImage ? "warn" : "fail",
    headline: ogTitle && ogImage ? "Set" : ogTitle || ogImage ? "Incomplete" : "Missing",
    detail:
      ogTitle && ogImage
        ? "Links to your site show a proper title and image on Facebook, LinkedIn and in texts."
        : "Links to your site may show no image or the wrong text when shared on Facebook, LinkedIn or in texts.",
    fix: ogTitle && ogImage ? "" : "Set an Open Graph title, description and a 1200×630 share image for your homepage and key pages.",
    weight: 3,
  });

  const siteName =
    metaContent(html, "property", "og:site_name") ||
    (typeof orgObj?.name === "string" ? orgObj.name : "") ||
    title.split(/\s[|\-–—:]\s/).pop() ||
    "";

  return {
    checks,
    meta: {
      title,
      siteName: decode(siteName),
      schemaName: typeof orgObj?.name === "string" ? decode(orgObj.name) : null,
      schemaCity: addr && typeof addr.addressLocality === "string" ? addr.addressLocality : null,
    },
  };
}
