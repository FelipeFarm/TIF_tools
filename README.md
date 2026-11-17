# TIF Tools

Four free lead-gen tools for The Idea Farm, built with Next.js and deployed on **Webflow Cloud**:

| Page | What it does |
|---|---|
| `/seo-plan-picker` | 6 questions → recommends Starter, Growth or Authority |
| `/ad-budget-estimator` | Industry + market + budget/leads goal → Google / Meta / LSA split and lead estimate |
| `/site-audit` | Semrush-style Site Audit: crawls up to 100 pages, runs 40+ checks, gives a Site Health score, saves each audit and compares re-runs |
| `/website-grader` | Enter a URL (plus optional competitor) → Google speed test, SEO basics, Google Business Profile lookup and local checks, scored out of 100. Fixes unlock with the lead form |

Each tool ends with a lead form that sends the contact plus their answers/results to **GoHighLevel** through an inbound webhook.

---

## Before going live: edit `lib/config.ts`

Everything marked **PLACEHOLDER** is a starting assumption, not a confirmed Idea Farm number:

- **SEO tiers:** articles per month, price label, what's included
- **Ad benchmarks:** cost per click, conversion rate and cost per lead by industry, market-size multipliers, minimum spend per channel

Have the SEO and Ads leads sanity-check these.

---

## Deploy to Webflow Cloud

1. **Push this folder to GitHub** (repo: `FelipeFarm/TIF_tools`).
2. **Choose where it lives:**
   - *On theideafarm.net* (recommended): open the TIF site in Webflow → **Site settings → Webflow Cloud → New project → Create app** → import the repo. Set the mount path to `/tools`.
   - *Standalone test first:* Workspace dashboard → **Apps → Deploy app** → import the repo.
3. **Add environment variables** (app → Environment → Environment variables):

   | Name | Value | Secret? |
   |---|---|---|
   | `NEXT_PUBLIC_BASE_PATH` | Your mount path, e.g. `/tools` (leave empty if standalone at the root) | No |
   | `GHL_WEBHOOK_URL` | GHL inbound webhook URL (see below) | **Yes** |
   | `NEXT_PUBLIC_BOOKING_URL` | GHL booking calendar link | No |
   | `GOOGLE_API_KEY` | Google Cloud API key for the Website Grader and Site Audit speed tests (see below) | **Yes** |
   | `AUDIT_MAX_PAGES` | Optional. Pages per Site Audit (default 100). Leave unset for the public tool | No |

4. **Deploy.** Then visit `theideafarm.net/tools` (or the `.webflow.io` URL Webflow gives you).

> Don't add `basePath` / `assetPrefix` to `next.config.ts`. Webflow Cloud sets them from the mount path.

---

## Site Audit

### How it works
1. **Start** (`/api/audit/start`): resolves the real homepage, reads robots.txt and the XML sitemap (including sitemap indexes).
2. **Crawl** (`/api/audit/crawl`): the visitor's browser drives the crawl, sending 6 URLs at a time. It goes breadth-first from the homepage, then visits sitemap-only URLs. This keeps every server request small (Cloudflare limits outbound requests per request) and shows live progress. It respects robots.txt and slows down automatically when a site starts showing bot checks.
3. **Link check** (`/api/audit/check-links`): status-checks up to 150 external links, images and internal files.
4. **Speed** (`/api/audit/speed`): Google mobile speed test on the homepage, run in the background during the crawl.
5. **Finish** (`/api/audit/finish`): builds the report, compares it with the last audit of the same site, and saves it.

### Checks (`lib/audit/issues.ts`)
- **Errors:** 4xx/5xx pages, pages that couldn't be crawled, broken internal links, broken images, missing or duplicate titles, duplicate descriptions, duplicate content, mixed content, redirect loops/long chains, canonicals pointing to broken pages, no HTTPS.
- **Warnings:** missing descriptions/H1, long titles, thin content, missing alt text, slow pages, very large pages, broken external links, temporary redirects, 2-hop redirect chains, links to http://, no viewport, no sitemap, bad sitemap URLs, poor Google mobile speed.
- **Notices:** orphan pages (only reported when the whole site was crawled), deep pages, pages with one internal link, links to redirects, nofollow internal links, multiple H1s, short titles, no canonical, noindex pages, robots.txt blocks, no robots.txt, bot-protected pages, no lang, no social preview, no schema, speed that needs improvement.

Each issue has a plain-English "why it matters" and "how to fix". Issue names and counts are free; the fixes and affected URLs unlock with the lead form (the same unlock as the Website Grader).

### Scores
- **Site Health:** average page cleanliness. Each distinct error on a page costs 35% of that page's score and each warning 8%. Notices don't count. Site-wide problems: no HTTPS −10 points, other site-wide warnings −3.
- **Thematic reports** (Crawlability, HTTPS, On-page SEO, Internal linking, Performance, Markup) use the same method, limited to each area's issues.
- **Bot protection:** pages that return a bot check (e.g. Cloudflare's "Just a moment…") are reported once as a notice and left out of every score, so a protected site isn't blamed for problems we couldn't see.
- **"No response":** links that time out are not reported as broken. Only real 4xx/5xx errors are.

### Saved audits and comparisons (SQLite)
Audits are saved in Webflow Cloud's SQLite database:
- `wrangler.json` declares the `DB` binding (`d1_databases`) and points at `./migrations`.
- `migrations/0001_site_audits.sql` creates the `site_audits` table. Webflow Cloud applies migrations automatically on deploy. Never edit a deployed migration; add `0002_…sql` instead.
- After the first deploy, Webflow Cloud assigns the real database ID. Copy it from the app's **Storage** tab into `database_id` in `wrangler.json` (replacing `replace-after-first-deploy`) and commit.
- Each report gets a shareable link (`/site-audit?id=…`). Re-auditing a site shows changes since its last audit: health points, error/warning/notice counts, new issues, and a "Fixed since…" list.
- If the database isn't connected, audits still run; they just aren't saved or compared.

### Turning it into an internal team tool later
- Raise the page limit with the `AUDIT_MAX_PAGES` environment variable (hard cap 1000). Don't do this on the public page: put team mode behind a login first.
- `lib/audit/config.ts` holds all the limits (batch sizes, link-check cap, thresholds for slow pages, thin content, etc.).

## Google API key for the Website Grader

The grader uses two Google APIs:

- **PageSpeed Insights API**: Google's mobile speed test (speed score, load time, layout stability, responsiveness). Free with a daily quota. It runs without a key, but a key gives you a much higher limit.
- **Places API (New)**: finds the business's Google Business Profile (rating, review count, whether it links to the site). Billed per lookup. Without a key this check is skipped.

Setup (about 10 minutes):

1. Go to console.cloud.google.com, create a project (e.g. "TIF Tools") and attach a billing account.
2. **APIs & Services → Library**: enable **PageSpeed Insights API** and **Places API (New)**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Restrict the key: under *API restrictions*, allow only those two APIs.
5. **Set a budget alert and quota cap**: Billing → Budgets & alerts (e.g. $25/month), and in *Places API (New) → Quotas* cap Text Search requests per day (e.g. 300). That stops bots from running up the bill.
6. In Webflow Cloud, add `GOOGLE_API_KEY` as a **secret** environment variable and redeploy.

Each grade makes 1 speed test and 1 Places lookup per site (2 of each with a competitor). If either API fails or is slow, the grader still finishes with the other checks and says the speed test was unavailable.

### How the grader report works

- Score, category bars, Google speed numbers and each check's short result are free to see.
- The explanation and the "How to fix" for each issue stay blurred until the visitor submits the lead form. Unlocking is remembered in their browser, so they don't have to fill it in again.
- The lead sent to GHL includes their score, Google speed score, Business Profile status, the list of issues and the competitor's score, so the Account Lead can open the call with specifics.
- The Business Profile is only counted as found when the listing links to the same website. If the visitor types their business name and the top listing matches it but links elsewhere, it's flagged as "Not linked to site". We never guess from a name alone.

## Connect leads to GoHighLevel

1. In GHL: **Automation → Workflows → Create workflow → Trigger: Inbound Webhook**. Copy the webhook URL.
2. Put it in `GHL_WEBHOOK_URL` in Webflow Cloud and redeploy.
3. Submit a test lead from any tool, then click **Fetch sample request** in the GHL trigger so the fields show up.
4. Add a **Create/Update Contact** action and map the fields:

   | Webhook field | GHL contact field |
   |---|---|
   | `first_name`, `last_name`, `email`, `phone` | Same-name fields |
   | `company_name` | Business Name |
   | `website` | Website |
   | `source` | Source |
   | `tags` | Tags (`tif-tools` + the tool name) |
   | `tool_summary` | Add as a **Note**. Contains their answers/results so the Account Lead has context |

5. Add whatever follow-up you want (assign to a user, internal notification, pipeline opportunity).

If `GHL_WEBHOOK_URL` isn't set, the forms still show "Thanks" but the lead is only written to the Webflow Cloud logs. That's fine for a first test deploy, but don't promote the tools until the webhook is connected.

---

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Copy `.env.example` to `.env.local` to test the GHL webhook locally.

## Notes

- API routes (`/api/lead`, `/api/grade`) use the default Node.js runtime. Don't add `export const runtime = "edge"`: with Next.js 16 on Webflow Cloud it makes every API route return a 500.
- The grader blocks private/internal addresses (including redirects to them) and only checks the homepage of public sites. Some sites block automated checks and will show a friendly error.
- `PSI_ENDPOINT` / `PLACES_ENDPOINT` env vars exist only for testing against a mock server. Leave them unset in production.
- Bandwidth from the app counts toward the TIF site's usage. Check the **Usage** tab after launch.
