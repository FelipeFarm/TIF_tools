/**
 * ─────────────────────────────────────────────────────────────
 *  EDIT THIS FILE to change plans, prices and ad benchmarks.
 *  Every number marked PLACEHOLDER is a starting assumption,
 *  not a confirmed Idea Farm figure. Replace before going live.
 * ─────────────────────────────────────────────────────────────
 */

export const BRAND = {
  name: "The Idea Farm",
  byline: "by VM Digital",
};

/* ───────────── SEO plans ───────────── */

export type SeoTierId = "starter" | "growth" | "authority";

export interface SeoTier {
  id: SeoTierId;
  name: string;
  articlesPerMonth: number; // PLACEHOLDER: confirm per-tier article count
  priceLabel: string; // PLACEHOLDER: e.g. "$1,500/mo" or "Custom quote"
  bestFor: string;
  includes: string[];
}

export const SEO_TIERS: Record<SeoTierId, SeoTier> = {
  starter: {
    id: "starter",
    name: "Starter",
    articlesPerMonth: 2,
    priceLabel: "Custom quote",
    bestFor: "Single-location businesses in less competitive markets that need the foundations done right.",
    includes: [
      "Technical SEO setup (Search Console, GA4, sitemap, indexing)",
      "Google Business Profile optimization",
      "Local & brand SEO",
      "SEO articles every month",
      "Monthly performance report",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    articlesPerMonth: 4,
    priceLabel: "Custom quote",
    bestFor: "Businesses ready to outrank local competitors and grow steady inbound leads.",
    includes: [
      "Everything in Starter",
      "More content every month",
      "Service & location page optimization",
      "Competitor keyword gap tracking",
      "Monthly performance report",
    ],
  },
  authority: {
    id: "authority",
    name: "Authority",
    articlesPerMonth: 8,
    priceLabel: "Custom quote",
    bestFor: "Multi-location or highly competitive businesses that want to own their category.",
    includes: [
      "Everything in Growth",
      "Highest monthly content volume",
      "Multi-location SEO strategy",
      "Topical authority content clusters",
      "Monthly performance report",
    ],
  },
};

/* ───────────── Ad benchmarks ───────────── */

export interface IndustryBenchmark {
  label: string;
  /** Average cost per click / per lead in USD — ALL PLACEHOLDERS */
  googleCpc: number;
  googleConvRate: number; // click → lead
  metaCpl: number; // Meta cost per lead
  lsaCpl: number | null; // null = LSA not available for this industry
}

export const INDUSTRIES: Record<string, IndustryBenchmark> = {
  home_services: { label: "Home services (HVAC, plumbing, roofing…)", googleCpc: 7, googleConvRate: 0.1, metaCpl: 45, lsaCpl: 40 },
  legal: { label: "Legal", googleCpc: 9, googleConvRate: 0.07, metaCpl: 80, lsaCpl: 90 },
  financial: { label: "Financial services & lending", googleCpc: 6, googleConvRate: 0.06, metaCpl: 60, lsaCpl: 75 },
  health: { label: "Healthcare, dental & wellness", googleCpc: 5, googleConvRate: 0.08, metaCpl: 40, lsaCpl: 55 },
  real_estate: { label: "Real estate", googleCpc: 2.5, googleConvRate: 0.05, metaCpl: 25, lsaCpl: 50 },
  professional: { label: "Professional services (consulting, compliance…)", googleCpc: 5, googleConvRate: 0.06, metaCpl: 55, lsaCpl: null },
  retail: { label: "Retail & e-commerce", googleCpc: 1.5, googleConvRate: 0.03, metaCpl: 20, lsaCpl: null },
  restaurant: { label: "Restaurants & hospitality", googleCpc: 1.8, googleConvRate: 0.04, metaCpl: 15, lsaCpl: null },
  nonprofit: { label: "Churches & nonprofits", googleCpc: 1.5, googleConvRate: 0.04, metaCpl: 15, lsaCpl: null },
};

/** Cost multiplier by market size — PLACEHOLDER */
export const MARKETS: Record<string, { label: string; multiplier: number }> = {
  small: { label: "Small town / rural", multiplier: 0.8 },
  mid: { label: "Mid-size city", multiplier: 1.0 },
  metro: { label: "Major metro (Houston, Toronto, LA…)", multiplier: 1.3 },
  national: { label: "National / online", multiplier: 1.15 },
};

/** Minimum monthly spend we recommend per channel — PLACEHOLDER */
export const MIN_SPEND = { google: 1000, meta: 600, lsa: 500 };

/** ± spread shown around estimates */
export const ESTIMATE_SPREAD = 0.25;
