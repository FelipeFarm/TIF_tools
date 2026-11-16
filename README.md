# TIF Tools

Three free lead-gen tools for The Idea Farm, built with Next.js and deployed on **Webflow Cloud**:

| Page | What it does |
|---|---|
| `/seo-plan-picker` | 6 questions → recommends Starter, Growth or Authority |
| `/ad-budget-estimator` | Industry + market + budget/leads goal → Google / Meta / LSA split and lead estimate |
| `/website-grader` | Enter a URL → 14-point check (SEO basics, mobile, speed, HTTPS, social) with a score out of 100 |

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

4. **Deploy.** Then visit `theideafarm.net/tools` (or the `.webflow.io` URL Webflow gives you).

> Don't add `basePath` / `assetPrefix` to `next.config.ts`. Webflow Cloud sets them from the mount path.

---

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

- API routes (`/api/lead`, `/api/grade`) use the Edge runtime, as Webflow Cloud requires.
- The grader blocks private/internal addresses and only checks the homepage of public sites. Some sites block automated checks and will show a friendly error.
- Bandwidth from the app counts toward the TIF site's usage. Check the **Usage** tab after launch.
