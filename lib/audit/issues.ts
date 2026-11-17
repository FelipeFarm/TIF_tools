import { DEEP_DEPTH, LARGE_HTML_BYTES, LOW_WORDS, MAX_AFFECTED, SLOW_MS } from "./config";
import { THEMES, type AffectedUrl, type HomepageReport, type AuditReport, type Issue, type LinkStatus, type PageRecord, type Severity, type SiteInfo, type SpeedSummary, type Theme } from "./types";
import { isInternal, isOffOrigin, isPaginated, pathOf, sameUrl, toOrigin } from "./urls";

interface Def {
  id: string;
  severity: Severity;
  theme: Theme;
  title: string;
  why: string;
  fix: string;
  /** Site-level issues don't belong to a page */
  site?: boolean;
}

/* ───────────── Issue catalog ───────────── */
const DEFS: Def[] = [
  // Errors
  { id: "http4xx", severity: "error", theme: "Crawlability", title: "Pages return 4xx errors", why: "Visitors and Google hit a dead end (e.g. 404 Not Found). Broken pages waste link value and make the site look neglected.", fix: "Restore the page, or 301-redirect the old URL to the most relevant live page. Then update any internal links that point to it." },
  { id: "http5xx", severity: "error", theme: "Crawlability", title: "Pages return 5xx server errors", why: "The server failed to deliver the page. If Google keeps seeing 5xx errors it will drop the page from search.", fix: "Check your hosting/server logs for the cause (plugin crash, timeouts, memory limits) and fix it, then re-test the URLs." },
  { id: "not_crawled", severity: "error", theme: "Crawlability", title: "Pages couldn't be crawled", why: "The page timed out or refused the connection. If we can't load it, Google may not be able to either.", fix: "Open the URLs yourself. If they're slow or failing, check hosting performance, firewalls or bot-protection rules that might block crawlers." },
  { id: "broken_internal_links", severity: "error", theme: "Internal linking", title: "Broken internal links", why: "Links on your own site lead to error pages. That frustrates visitors and stops Google from following your site structure.", fix: "Update each link to point to a working page, or redirect the broken URL to the right destination." },
  { id: "broken_images", severity: "error", theme: "On-page SEO", title: "Broken images", why: "Images fail to load, so visitors see empty boxes and the page looks broken.", fix: "Re-upload the missing images or update the image URLs. Remove images that are no longer needed." },
  { id: "missing_title", severity: "error", theme: "On-page SEO", title: "Missing title tags", why: "The title is the blue link people click in Google. Without one, Google invents its own and your click-through rate suffers.", fix: "Add a unique 30–60 character title to every page, leading with the page's main topic and location." },
  { id: "duplicate_title", severity: "error", theme: "On-page SEO", title: "Duplicate title tags", why: "Several pages share the same title, so Google can't tell which one to rank and they compete with each other.", fix: "Give every page a unique title that describes that specific page (service + city works well for local pages)." },
  { id: "duplicate_description", severity: "error", theme: "On-page SEO", title: "Duplicate meta descriptions", why: "Pages reuse the same description, so their search snippets look identical and less relevant.", fix: "Write a unique 120–160 character description for each page that sums up that page and ends with a call to action." },
  { id: "duplicate_content", severity: "error", theme: "On-page SEO", title: "Duplicate content", why: "Pages have identical text. Google usually picks one and ignores the rest, so the copies won't rank.", fix: "Rewrite the pages so each has unique content, merge them into one, or point the copies to the main version with a canonical tag." },
  { id: "mixed_content", severity: "error", theme: "HTTPS", title: "Mixed content (HTTP files on HTTPS pages)", why: "Secure pages load images or scripts over insecure http://. Browsers block some of them and may show a 'Not secure' warning.", fix: "Change every http:// resource URL to https:// (or a relative URL), and re-upload any files whose host doesn't support HTTPS." },
  { id: "redirect_loop", severity: "error", theme: "Crawlability", title: "Redirect loops and long chains", why: "URLs redirect in a circle or hop 3+ times. Visitors wait longer and Google may give up following them.", fix: "Point each old URL straight to its final destination with a single 301 redirect, and remove circular rules." },
  { id: "broken_canonical", severity: "error", theme: "On-page SEO", title: "Canonical points to a broken page", why: "The canonical tag tells Google the 'main' version is a page that returns an error, which can knock this page out of search.", fix: "Update the canonical tag to point to the correct, working URL (usually the page itself)." },
  { id: "no_https", severity: "error", theme: "HTTPS", title: "Site doesn't use HTTPS", why: "Browsers label the site 'Not secure' and Google ranks it lower.", fix: "Enable SSL with your host (free on Webflow, Squarespace, Wix and most hosts) and redirect all http:// traffic to https://.", site: true },

  // Warnings
  { id: "missing_description", severity: "warning", theme: "On-page SEO", title: "Missing meta descriptions", why: "Google pulls random text for the search snippet, which usually hurts clicks.", fix: "Add a unique 120–160 character description to each page that says what it offers and why to click." },
  { id: "missing_h1", severity: "warning", theme: "On-page SEO", title: "Missing H1 heading", why: "The H1 is a strong signal of what the page is about, and it orients visitors.", fix: "Add one clear H1 near the top of each page that states the page's main topic." },
  { id: "title_too_long", severity: "warning", theme: "On-page SEO", title: "Title tags too long", why: "Google cuts titles off at about 60 characters, so the end of your message is lost.", fix: "Shorten titles to 30–60 characters and put the most important words first." },
  { id: "low_word_count", severity: "warning", theme: "On-page SEO", title: `Low word count (under ${LOW_WORDS} words)`, why: "Thin pages give Google little to understand and rarely rank for competitive searches.", fix: "Expand key pages with genuinely useful content: what you offer, who it's for, process, FAQs, proof (reviews, results) and service areas." },
  { id: "missing_alt", severity: "warning", theme: "On-page SEO", title: "Images missing alt text", why: "Screen readers can't describe these images and Google Images can't index them.", fix: "Add a short, specific description to each image's alt text. Decorative images can use an empty alt (alt=\"\")." },
  { id: "slow_pages", severity: "warning", theme: "Performance", title: `Slow pages (over ${SLOW_MS / 1000}s to respond)`, why: "Slow pages lose visitors, especially on mobile, and Google favors fast sites.", fix: "Upgrade hosting or add a CDN, enable caching, and remove heavy plugins/scripts that run on every page." },
  { id: "large_html", severity: "warning", theme: "Performance", title: "Very large pages", why: `The HTML is over ${LARGE_HTML_BYTES / 1024} KB before images, which slows the first load on phones.`, fix: "Remove inline code you don't need, paginate very long lists, and move big embedded data out of the page." },
  { id: "broken_external_links", severity: "warning", theme: "Internal linking", title: "Broken external links", why: "Links to other websites lead to error pages, which looks careless to visitors.", fix: "Update the links to working pages or remove them." },
  { id: "temporary_redirects", severity: "warning", theme: "Crawlability", title: "Temporary redirects (302/307)", why: "Temporary redirects tell Google the move isn't permanent, so the new URL may not get full credit.", fix: "If the move is permanent, change these to 301 redirects." },
  { id: "redirect_chain", severity: "warning", theme: "Crawlability", title: "Redirect chains (2 hops)", why: "The URL redirects twice before reaching the page, adding delay.", fix: "Redirect the first URL directly to the final destination." },
  { id: "links_to_http", severity: "warning", theme: "HTTPS", title: "Internal links to HTTP pages", why: "Your secure pages link to insecure http:// versions of your own site, causing extra redirects or security warnings.", fix: "Update the links to use https:// (or relative links)." },
  { id: "no_viewport", severity: "warning", theme: "Markup", title: "Not set up for mobile (no viewport tag)", why: "Phones may show a tiny, zoomed-out desktop page.", fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to every page.' },
  { id: "sitemap_missing", severity: "warning", theme: "Crawlability", title: "No XML sitemap found", why: "A sitemap helps Google find all your pages quickly, especially new ones.", fix: "Create an XML sitemap (Webflow, WordPress/Yoast and Squarespace can do it automatically), reference it in robots.txt and submit it in Google Search Console.", site: true },
  { id: "sitemap_bad_urls", severity: "warning", theme: "Crawlability", title: "Sitemap lists broken or redirected URLs", why: "Your sitemap should only list live pages. Bad entries waste Google's crawl time and erode trust in the sitemap.", fix: "Remove dead URLs from the sitemap and replace redirected ones with their final URL." },
  { id: "slow_mobile_speed", severity: "warning", theme: "Performance", title: "Poor Google mobile speed score", why: "Google's speed test puts your homepage in the red zone on phones.", fix: "Compress and resize images (WebP/AVIF), lazy-load below-the-fold images, remove unused scripts and widgets, and load fonts efficiently.", site: true },

  // Homepage / local checks (from the in-depth homepage check)
  { id: "gbp_missing", severity: "warning", theme: "Local SEO", title: "No Google Business Profile found", why: "Your Business Profile is what shows in Google Maps and the local 'map pack', often where local customers call from. We couldn't find one that links to this website.", fix: "Claim or create your profile at business.google.com, verify it, add your website link, categories, hours, photos and services. If you already have one, make sure its website field is this exact address.", site: true },
  { id: "gbp_not_linked", severity: "warning", theme: "Local SEO", title: "Google Business Profile doesn't link to this site", why: "We found a listing with your business name, but its website field points elsewhere, so Google may not connect your profile and your site.", fix: "Edit your Business Profile and set the website to this exact address. Make sure your name, address and phone match the site word for word.", site: true },
  { id: "gbp_few_reviews", severity: "notice", theme: "Local SEO", title: "Few or low Google reviews", why: "Profiles with more recent reviews (20+ at 4.3★ or higher) tend to win the map results.", fix: "Send a review link by text or email after every job, reply to every review, and post photos and updates monthly.", site: true },
  { id: "no_click_to_call", severity: "warning", theme: "Local SEO", title: "No phone number on the homepage", why: "For local businesses, calls are often the #1 lead source. We couldn't find a phone number on the homepage.", fix: "Put your phone number in the header and footer as a tap-to-call link (tel:). Use the same number as your Google Business Profile.", site: true },
  { id: "phone_not_clickable", severity: "notice", theme: "Local SEO", title: "Phone number isn't tap-to-call", why: "Your number is on the homepage, but mobile visitors have to copy it instead of tapping to call.", fix: "Wrap the number in a tel: link, e.g. <a href=\"tel:+17135551234\">.", site: true },
  { id: "no_local_schema", severity: "notice", theme: "Local SEO", title: "No LocalBusiness schema on the homepage", why: "Structured data with your business name, address and phone supports local rankings and rich results.", fix: "Add LocalBusiness schema (or the closest type, like Dentist or Plumber) with name, address, phone, hours and service area, matching your Business Profile exactly.", site: true },
  { id: "slow_lcp", severity: "warning", theme: "Performance", title: "Main content loads slowly on phones (LCP)", why: "The biggest thing on screen (usually the hero image or headline) takes too long to appear. Google's target is under 2.5s.", fix: "Shrink and preload the hero image, avoid hero videos/sliders on mobile, and make sure the headline isn't waiting on fonts or scripts.", site: true },
  { id: "layout_shift", severity: "warning", theme: "Performance", title: "Page jumps around while loading (CLS)", why: "Content shifting as the page loads causes mis-taps and frustration. Google's target is under 0.1.", fix: "Set width and height on images and embeds, reserve space for banners and pop-ups, and avoid injecting content above what's on screen.", site: true },
  { id: "slow_response", severity: "warning", theme: "Performance", title: "Slow to respond to taps", why: "Heavy scripts keep the page from reacting quickly to taps and clicks. Google's target is under 200ms.", fix: "Remove unused apps and widgets, delay non-essential scripts, and break up long JavaScript tasks.", site: true },

  // Notices
  { id: "orphan_pages", severity: "notice", theme: "Internal linking", title: "Orphan pages (in sitemap, no internal links)", why: "Nothing on your site links to these pages, so visitors can't find them and Google sees them as unimportant.", fix: "Link to these pages from relevant pages, menus or hub pages, or remove them from the sitemap if they're obsolete." },
  { id: "deep_pages", severity: "notice", theme: "Internal linking", title: `Pages more than ${DEEP_DEPTH} clicks from the homepage`, why: "Deeply buried pages get crawled less often and carry less weight.", fix: "Link to important pages from the homepage, main menu or category pages so they're within 3 clicks." },
  { id: "single_inlink", severity: "notice", theme: "Internal linking", title: "Pages with only one internal link", why: "Pages with few internal links pointing at them are seen as less important.", fix: "Add contextual links to these pages from related pages and blog posts." },
  { id: "links_to_redirects", severity: "notice", theme: "Internal linking", title: "Internal links pointing to redirects", why: "Links that go through a redirect add delay and leak a little link value.", fix: "Update the links to point straight at the final URL." },
  { id: "nofollow_internal", severity: "notice", theme: "Internal linking", title: "Nofollow internal links", why: "Nofollow on your own links tells Google not to pass value to your own pages.", fix: "Remove rel=\"nofollow\" from internal links unless you have a specific reason." },
  { id: "multiple_h1", severity: "notice", theme: "On-page SEO", title: "Multiple H1 headings", why: "More than one H1 muddies the signal about the page's main topic.", fix: "Keep one H1 per page and change the others to H2s." },
  { id: "title_too_short", severity: "notice", theme: "On-page SEO", title: "Title tags too short", why: "Very short titles leave out keywords people search for.", fix: "Expand titles to 30–60 characters: main topic, location, brand." },
  { id: "missing_canonical", severity: "notice", theme: "On-page SEO", title: "No canonical tag", why: "Without a canonical, Google may treat URL variants (with/without www, parameters) as duplicates.", fix: "Add a self-referencing canonical tag to every page." },
  { id: "noindex_pages", severity: "notice", theme: "Crawlability", title: "Pages blocked from Google (noindex)", why: "These pages tell Google not to show them in search. That's fine for thank-you or private pages, but not for service pages.", fix: "Check the list. Remove noindex from any page you want found in Google." },
  { id: "blocked_by_robots", severity: "notice", theme: "Crawlability", title: "Pages blocked by robots.txt", why: "robots.txt stops crawlers from visiting these URLs. Make sure that's intentional.", fix: "Review the Disallow rules in robots.txt and remove any that block pages you want in Google." },
  { id: "robots_missing", severity: "notice", theme: "Crawlability", title: "No robots.txt file", why: "robots.txt tells crawlers where your sitemap is and what to skip.", fix: "Add a robots.txt at the site root that allows crawling and lists your sitemap URL.", site: true },
  { id: "bot_protection", severity: "notice", theme: "Crawlability", title: "Pages behind bot protection", why: "These pages showed a bot check (like Cloudflare's “Just a moment…”) instead of content, so we couldn't audit them. Google is usually allowed through, but some crawlers, SEO tools and AI search engines get blocked.", fix: "If you use Cloudflare or a security plugin, make sure verified bots and SEO tools aren't challenged, and avoid challenging normal page loads. These pages weren't counted in your score." },
  { id: "missing_lang", severity: "notice", theme: "Markup", title: "Page language not set", why: "Declaring the language helps screen readers and search engines.", fix: 'Add lang="en" (or your language) to the <html> tag.' },
  { id: "missing_og", severity: "notice", theme: "Markup", title: "No social sharing preview", why: "Links shared on Facebook, LinkedIn or in texts may show no image or the wrong text.", fix: "Set an Open Graph title, description and 1200×630 image for each important page." },
  { id: "missing_schema", severity: "notice", theme: "Markup", title: "No structured data (schema)", why: "Structured data helps Google understand your business and can earn rich results like ratings and FAQs.", fix: "Add LocalBusiness/Organization schema sitewide, plus Service, FAQ or Article schema where relevant." },
  { id: "speed_needs_work", severity: "notice", theme: "Performance", title: "Google mobile speed needs improvement", why: "Your homepage is in Google's 'needs improvement' range on phones.", fix: "Optimize the hero image, defer non-essential scripts, and trim third-party widgets.", site: true },
];

const SEV_ORDER: Record<Severity, number> = { error: 0, warning: 1, notice: 2 };

/** Titles/severity by id, for showing issues fixed since the last audit */
export const ISSUE_INFO: Record<string, { title: string; severity: Severity }> = Object.fromEntries(
  DEFS.map((d) => [d.id, { title: d.title, severity: d.severity }])
);

export function buildReport(input: {
  site: SiteInfo;
  pages: PageRecord[];
  links: LinkStatus[];
  blocked: string[];
  speed: SpeedSummary | null;
  maxPages: number;
  limitReached: boolean;
  homepage?: HomepageReport | null;
  competitor?: HomepageReport | null;
}): Omit<AuditReport, "id" | "createdAt" | "compare" | "saved"> {
  const { site, pages, links, blocked, speed } = input;
  const hits = new Map<string, AffectedUrl[]>();
  const add = (id: string, url: string, info?: string) => {
    const arr = hits.get(id) ?? [];
    arr.push(info ? { url, info } : { url });
    hits.set(id, arr);
  };

  // Status of every URL we know about
  const status = new Map<string, number>();
  const redirected = new Map<string, number>();
  for (const p of pages) {
    status.set(p.url, p.status);
    if (p.redirects.length) redirected.set(p.url, p.redirects[0].status);
    if (p.finalUrl && !status.has(p.finalUrl)) status.set(p.finalUrl, p.status);
  }
  for (const l of links) if (l.status >= 0 && !status.has(l.url)) status.set(l.url, l.status);
  // Only definite HTTP errors count as broken. "No response" (0) may be a network blip, so it isn't reported as broken.
  const isBroken = (u: string) => {
    const s = status.get(u);
    return s !== undefined && s >= 400;
  };

  const challenged = pages.filter((p) => p.challenge);
  const ok = pages.filter((p) => p.status === 200 && p.isHtml && !p.challenge && p.title !== undefined && isInternal(p.finalUrl, site.host));
  // A page that redirects to another crawled page shouldn't be counted twice
  const seenFinal = new Set<string>();
  const uniqueOk = ok.filter((p) => (seenFinal.has(p.finalUrl) ? false : (seenFinal.add(p.finalUrl), true)));

  // Same-site links may use another host variant (no www, http). Treat them as the page they redirect to.
  const L = (u: string) => toOrigin(u, site.origin);

  /* ── Real click depth: shortest path from the homepage through the links we found ──
     (independent of crawl order, which prioritizes sitemap pages) */
  const finalOf = new Map<string, string>();
  for (const p of pages) finalOf.set(p.url, p.finalUrl);
  const byFinal = new Map(uniqueOk.map((p) => [p.finalUrl, p]));
  const home = byFinal.get(site.startUrl) ?? uniqueOk.find((p) => p.depth === 0);
  const depthOf = new Map<string, number>();
  if (home) {
    depthOf.set(home.finalUrl, 0);
    let frontier = [home];
    while (frontier.length) {
      const next: PageRecord[] = [];
      for (const p of frontier) {
        const d = depthOf.get(p.finalUrl)!;
        for (const l of p.internalLinks ?? []) {
          const target = byFinal.get(finalOf.get(L(l.url)) ?? L(l.url));
          if (target && !depthOf.has(target.finalUrl)) {
            depthOf.set(target.finalUrl, d + 1);
            next.push(target);
          }
        }
      }
      frontier = next;
    }
  }
  const clickDepth = (p: PageRecord): number | null => depthOf.get(p.finalUrl) ?? null;

  /* Pages Google won't treat as standalone: pagination, and pages canonicalized to another URL.
     They're excluded from duplicate and thin-content checks. */
  const canonicalizedAway = (p: PageRecord) => !!p.canonical && !sameUrl(p.canonical, p.finalUrl);
  const secondary = (p: PageRecord) => isPaginated(p.finalUrl) || isPaginated(p.url) || canonicalizedAway(p);

  // Incoming internal links
  const inlinks = new Map<string, Set<string>>();
  for (const p of uniqueOk) {
    for (const l of p.internalLinks ?? []) {
      const key = finalOf.get(L(l.url)) ?? L(l.url);
      if (key === p.finalUrl) continue;
      const set = inlinks.get(key) ?? new Set();
      set.add(p.finalUrl);
      inlinks.set(key, set);
    }
  }
  const inCount = (p: PageRecord) => new Set([...(inlinks.get(p.url) ?? []), ...(inlinks.get(p.finalUrl) ?? [])]).size;

  /* ── Per-URL status issues ── */
  for (const p of pages) {
    if (p.status >= 400 && p.status < 500) add("http4xx", p.url, `${p.status}`);
    else if (p.status >= 500) add("http5xx", p.url, `${p.status}`);
    else if (p.status === 0) add("not_crawled", p.url, p.error);
    if (p.loop || p.redirects.length >= 3) add("redirect_loop", p.url, p.loop ? "Loop" : `${p.redirects.length} hops`);
    else if (p.redirects.length === 2) add("redirect_chain", p.url, `→ ${pathOf(p.finalUrl)}`);
    if (p.redirects.some((r) => r.status === 302 || r.status === 307)) add("temporary_redirects", p.url, `→ ${pathOf(p.finalUrl)}`);
  }

  /* ── Sitemap quality ── */
  // Sitemap URLs folded onto the real origin, so a sitemap that lists non-www/http URLs still matches the crawl
  const sitemapSet = new Set(site.sitemap.urls.map((u) => toOrigin(u, site.origin)));
  for (const p of pages) {
    if (sitemapSet.has(p.url) && (p.status !== 200 || p.redirects.length)) {
      add("sitemap_bad_urls", p.url, p.redirects.length ? `Redirects (${p.redirects[0].status})` : `${p.status || "No response"}`);
    }
  }
  for (const u of site.sitemap.urls) if (isOffOrigin(u, site.origin)) add("sitemap_bad_urls", u, "Wrong address version (redirects)");

  /* ── Page-level content checks ── */
  const byTitle = new Map<string, PageRecord[]>();
  const byDesc = new Map<string, PageRecord[]>();
  const byHash = new Map<string, PageRecord[]>();
  for (const p of uniqueOk) {
    const t = (p.title || "").trim();
    const d = (p.description || "").trim();
    const h1 = p.h1s ?? [];
    if (!t) add("missing_title", p.finalUrl);
    else {
      if (t.length > 65) add("title_too_long", p.finalUrl, `${t.length} chars`);
      if (t.length < 25) add("title_too_short", p.finalUrl, `${t.length} chars`);
      if (!p.noindex && !secondary(p)) byTitle.set(t.toLowerCase(), [...(byTitle.get(t.toLowerCase()) ?? []), p]);
    }
    if (!d) add("missing_description", p.finalUrl);
    else if (!p.noindex && !secondary(p)) byDesc.set(d.toLowerCase(), [...(byDesc.get(d.toLowerCase()) ?? []), p]);
    if (p.textHash && !p.noindex && !secondary(p)) byHash.set(p.textHash, [...(byHash.get(p.textHash) ?? []), p]);
    if (h1.length === 0) add("missing_h1", p.finalUrl);
    else if (h1.length > 1) add("multiple_h1", p.finalUrl, `${h1.length} H1s`);
    if (!p.noindex && !secondary(p) && (p.words ?? 0) < LOW_WORDS) add("low_word_count", p.finalUrl, `${p.words ?? 0} words`);
    const noAlt = (p.images ?? []).filter((i) => !i.alt).length;
    if (noAlt) add("missing_alt", p.finalUrl, `${noAlt} image${noAlt === 1 ? "" : "s"}`);
    if (p.ms > SLOW_MS) add("slow_pages", p.finalUrl, `${(p.ms / 1000).toFixed(1)}s`);
    if (p.bytes > LARGE_HTML_BYTES) add("large_html", p.finalUrl, `${Math.round(p.bytes / 1024)} KB`);
    if (p.mixed?.length) add("mixed_content", p.finalUrl, `${p.mixed.length} file${p.mixed.length === 1 ? "" : "s"}`);
    if (!p.canonical) add("missing_canonical", p.finalUrl);
    else if (isBroken(p.canonical)) add("broken_canonical", p.finalUrl, `→ ${pathOf(p.canonical)}`);
    if (p.noindex) add("noindex_pages", p.finalUrl);
    if (!p.viewport) add("no_viewport", p.finalUrl);
    if (!p.lang) add("missing_lang", p.finalUrl);
    if (!p.hasOg) add("missing_og", p.finalUrl);
    if (!p.hasSchema) add("missing_schema", p.finalUrl);

    // Links
    const brokenInt = (p.internalLinks ?? []).filter((l) => isBroken(l.url) || isBroken(L(l.url)));
    if (brokenInt.length) add("broken_internal_links", p.finalUrl, brokenInt.slice(0, 3).map((l) => `→ ${pathOf(l.url)} (${status.get(l.url) ?? status.get(L(l.url)) ?? "no response"})`).join(", ") + (brokenInt.length > 3 ? ` +${brokenInt.length - 3} more` : ""));
    const brokenExt = (p.externalLinks ?? []).filter((u) => isBroken(u));
    if (brokenExt.length) add("broken_external_links", p.finalUrl, brokenExt.slice(0, 2).map((u) => `→ ${u} (${status.get(u) || "no response"})`).join(", ") + (brokenExt.length > 2 ? ` +${brokenExt.length - 2} more` : ""));
    const brokenImg = (p.images ?? []).filter((i) => isBroken(i.src));
    if (brokenImg.length) add("broken_images", p.finalUrl, `${brokenImg.length} image${brokenImg.length === 1 ? "" : "s"}`);
    if (site.https) {
      const httpLinks = (p.internalLinks ?? []).filter((l) => l.url.startsWith("http:"));
      if (httpLinks.length) add("links_to_http", p.finalUrl, `${httpLinks.length} link${httpLinks.length === 1 ? "" : "s"}`);
    }
    // Links that go through a redirect: to a URL we saw redirect, or to another host variant (no www, etc.)
    const toRedirect = (p.internalLinks ?? []).filter((l) => !l.url.startsWith("http:") && (redirected.has(L(l.url)) || isOffOrigin(l.url, site.origin)));
    if (toRedirect.length) add("links_to_redirects", p.finalUrl, `${toRedirect.length} link${toRedirect.length === 1 ? "" : "s"}`);
    const nofollow = (p.internalLinks ?? []).filter((l) => l.nofollow).length;
    if (nofollow) add("nofollow_internal", p.finalUrl, `${nofollow} link${nofollow === 1 ? "" : "s"}`);

    // Structure (click depth from the link graph)
    const depth = clickDepth(p);
    const isHome = depth === 0;
    const incoming = inCount(p);
    // Orphans are only reliable when the whole site was crawled
    if (!isHome && !input.limitReached && sitemapSet.has(p.url) && incoming === 0) add("orphan_pages", p.finalUrl);
    else if (!isHome && !isPaginated(p.finalUrl) && incoming === 1) add("single_inlink", p.finalUrl);
    if (depth !== null && depth > DEEP_DEPTH) add("deep_pages", p.finalUrl, `${depth} clicks`);
  }
  for (const [, group] of byTitle) if (group.length > 1) group.forEach((p) => add("duplicate_title", p.finalUrl, `Same as ${group.length - 1} other page${group.length > 2 ? "s" : ""}`));
  for (const [, group] of byDesc) if (group.length > 1) group.forEach((p) => add("duplicate_description", p.finalUrl, `Same as ${group.length - 1} other page${group.length > 2 ? "s" : ""}`));
  for (const [, group] of byHash) if (group.length > 1) group.forEach((p) => add("duplicate_content", p.finalUrl, `Matches ${group.slice(0, 2).filter((g) => g !== p).map((g) => pathOf(g.finalUrl)).join(", ")}`));

  for (const p of challenged) add("bot_protection", p.url);
  // One entry per path (login?next=… variants collapse into one)
  const blockedPaths = new Map<string, string>();
  for (const b of blocked) {
    try {
      const u = new URL(b);
      if (!blockedPaths.has(u.pathname)) blockedPaths.set(u.pathname, `${u.origin}${u.pathname}`);
    } catch {
      /* skip */
    }
  }
  for (const b of blockedPaths.values()) add("blocked_by_robots", b);

  /* ── Site-level ── */
  if (!site.https) add("no_https", site.startUrl);
  if (!site.sitemap.found) add("sitemap_missing", `${site.origin}/sitemap.xml`);
  if (!site.robots.found) add("robots_missing", `${site.origin}/robots.txt`);
  if (speed) {
    if (speed.performance < 50) add("slow_mobile_speed", site.startUrl, `${speed.performance}/100`);
    else if (speed.performance < 90) add("speed_needs_work", site.startUrl, `${speed.performance}/100`);
  }

  /* ── In-depth homepage check (speed details, Business Profile, local signals) ── */
  const hp = input.homepage;
  if (hp) {
    const hc = (id: string) => hp.checks.find((c) => c.id === id);
    const gbp = hc("gbp");
    if (gbp && gbp.status !== "pass") {
      const id = hp.gbp?.status === "not_found" ? "gbp_missing" : hp.gbp?.status === "possible" ? "gbp_not_linked" : "gbp_few_reviews";
      add(id, site.startUrl, hp.gbp?.name ? `${hp.gbp.name} · ${gbp.headline}` : gbp.headline);
    }
    const phone = hc("phone");
    if (phone?.status === "fail") add("no_click_to_call", site.startUrl);
    else if (phone?.status === "warn") add("phone_not_clickable", site.startUrl);
    const ls = hc("schema");
    if (ls && ls.status !== "pass") add("no_local_schema", site.startUrl, ls.headline);
    const lcp = hc("lcp");
    if (lcp && lcp.status !== "pass") add("slow_lcp", site.startUrl, lcp.headline);
    const cls = hc("cls");
    if (cls && cls.status !== "pass") add("layout_shift", site.startUrl, `CLS ${cls.headline}`);
    const resp = hc("inp") ?? hc("tbt");
    if (resp && resp.status !== "pass") add("slow_response", site.startUrl, resp.headline);
  }

  /* ── Assemble issues ── */
  const issues: Issue[] = DEFS.filter((d) => hits.has(d.id))
    .map((d) => {
      const all = hits.get(d.id)!;
      // de-duplicate by URL
      const uniq = [...new Map(all.map((a) => [a.url, a])).values()];
      return { id: d.id, severity: d.severity, theme: d.theme, title: d.title, why: d.why, fix: d.fix, count: uniq.length, affected: uniq.slice(0, MAX_AFFECTED) };
    })
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.count - a.count);

  const counts = {
    errors: issues.filter((i) => i.severity === "error").reduce((s, i) => s + i.count, 0),
    warnings: issues.filter((i) => i.severity === "warning").reduce((s, i) => s + i.count, 0),
    notices: issues.filter((i) => i.severity === "notice").reduce((s, i) => s + i.count, 0),
  };

  /* ── Site Health ──
     Based on how clean each crawled page is: every distinct error on a page costs 35% of that
     page's score and every warning 8% (floored at 0). Health is the average across pages.
     Notices don't count. Site-level problems: no HTTPS −10 pts, other site-level warnings −3 pts. */
  const perPage = new Map<string, { e: number; w: number }>();
  const defOf = new Map(DEFS.map((d) => [d.id, d]));
  for (const i of issues) {
    if (i.severity === "notice" || defOf.get(i.id)?.site) continue;
    for (const a of hits.get(i.id)!) {
      const c = perPage.get(a.url) ?? { e: 0, w: 0 };
      if (i.severity === "error") c.e++;
      else c.w++;
      perPage.set(a.url, c);
    }
  }
  // Bot-check pages aren't scored either way
  const crawledUrls = new Set([...uniqueOk.map((p) => p.finalUrl), ...pages.filter((p) => !p.challenge && !(p.status === 200 && p.isHtml)).map((p) => p.url)]);
  const n = Math.max(1, crawledUrls.size);
  let sum = 0;
  for (const u of crawledUrls) {
    const c = perPage.get(u);
    sum += c ? Math.max(0, 1 - 0.35 * c.e - 0.08 * c.w) : 1;
  }
  let health = (sum / n) * 100;
  for (const i of issues) {
    const d = defOf.get(i.id);
    if (d?.site) health -= i.severity === "error" ? 10 : i.severity === "warning" ? 3 : 0;
  }
  health = Math.max(0, Math.min(100, Math.round(health)));

  /* ── Thematic scores: same per-page method as Site Health, limited to that area's issues
     (errors −35%, warnings −8%, notices −2% per page; site-wide problems −25/−15/−5 pts in their area) ── */
  const themes = THEMES.filter((t) => t !== "Local SEO" || !!input.homepage).map((name) => {
    const tp = new Map<string, number>();
    let sitePenalty = 0;
    for (const i of issues.filter((x) => x.theme === name)) {
      const cost = i.severity === "error" ? 0.35 : i.severity === "warning" ? 0.08 : 0.02;
      if (defOf.get(i.id)?.site) {
        // Site-wide problems weigh more inside their own area (e.g. no Business Profile in Local SEO)
        sitePenalty += i.severity === "error" ? 25 : i.severity === "warning" ? 15 : 5;
        continue;
      }
      for (const a of hits.get(i.id)!) if (crawledUrls.has(a.url)) tp.set(a.url, (tp.get(a.url) ?? 0) + cost);
    }
    let total = 0;
    for (const u of crawledUrls) total += Math.max(0, 1 - (tp.get(u) ?? 0));
    return { name, score: Math.max(0, Math.min(100, Math.round((total / n) * 100 - sitePenalty))) };
  });

  /* ── Page list ── */
  const pageErr = new Map<string, { errors: number; warnings: number }>();
  for (const i of issues) {
    if (i.severity === "notice") continue;
    for (const a of hits.get(i.id)!) {
      const c = pageErr.get(a.url) ?? { errors: 0, warnings: 0 };
      if (i.severity === "error") c.errors++;
      else c.warnings++;
      pageErr.set(a.url, c);
    }
  }
  const pageRows = pages
    .filter((p) => p.challenge || !(p.status === 200 && p.isHtml && !uniqueOk.includes(p)))
    .map((p) => {
      const key = p.status === 200 ? p.finalUrl : p.url;
      const c = pageErr.get(key) ?? { errors: 0, warnings: 0 };
      return {
        url: key,
        status: p.status,
        depth: p.status === 200 && !p.challenge ? clickDepth(p) : p.depth,
        ms: p.ms,
        title: p.challenge ? "(bot check — not audited)" : (p.title ?? ""),
        words: p.words ?? 0,
        inlinks: inCount(p),
        errors: c.errors,
        warnings: c.warnings,
      };
    })
    .sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99) || a.url.localeCompare(b.url));

  return {
    host: site.host,
    startUrl: site.startUrl,
    pagesCrawled: pages.length,
    sitemapTotal: site.sitemap.urls.length,
    sitemapCrawled: (() => {
      const crawledSet = new Set(pages.flatMap((p) => [p.url, p.finalUrl]));
      return site.sitemap.urls.filter((u) => crawledSet.has(u) || crawledSet.has(toOrigin(u, site.origin))).length;
    })(),
    maxPages: input.maxPages,
    limitReached: input.limitReached,
    health,
    counts,
    themes,
    issues,
    pages: pageRows,
    speed,
    challenged: challenged.length,
    homepage: input.homepage ?? null,
    competitor: input.competitor ?? null,
  };
}
