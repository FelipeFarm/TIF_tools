# TIF Tools

Three free lead-gen tools for The Idea Farm, built with Next.js and deployed on **Webflow Cloud**:

| Page | What it does |
|---|---|
| `/seo-plan-picker` | 6 questions → recommends Starter, Growth or Authority |
| `/ad-budget-estimator` | Industry + market + budget/leads goal → Google / Meta / LSA split and lead estimate |
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
   | `GOOGLE_API_KEY` | Google Cloud API key for the website grader (see below) | **Yes** |

4. **Deploy.** Then visit `theideafarm.net/tools` (or the `.webflow.io` URL Webflow gives you).

> Don't add `basePath` / `assetPrefix` to `next.config.ts`. Webflow Cloud sets them from the mount path.

---

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
