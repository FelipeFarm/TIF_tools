export type Severity = "error" | "warning" | "notice";
export type Theme = "Crawlability" | "HTTPS" | "On-page SEO" | "Local SEO" | "Internal linking" | "Performance" | "Markup";
export const THEMES: Theme[] = ["Crawlability", "HTTPS", "On-page SEO", "Local SEO", "Internal linking", "Performance", "Markup"];

/** One crawled URL, as returned by /api/audit/crawl */
export interface PageRecord {
  url: string; // URL as requested (normalized)
  finalUrl: string;
  status: number; // 0 = could not fetch
  error?: string;
  redirects: { url: string; status: number }[]; // hops before finalUrl
  loop?: boolean;
  ms: number;
  bytes: number;
  isHtml: boolean;
  depth: number | null; // null = only found in sitemap
  /** Served a bot-protection / challenge page instead of real content */
  challenge?: boolean;
  title?: string;
  description?: string;
  h1s?: string[];
  canonical?: string | null;
  noindex?: boolean;
  lang?: boolean;
  viewport?: boolean;
  hasSchema?: boolean;
  hasOg?: boolean;
  words?: number;
  textHash?: string;
  internalLinks?: { url: string; nofollow: boolean }[];
  externalLinks?: string[];
  images?: { src: string; alt: boolean }[];
  mixed?: string[]; // http:// resources on an https page
}

export interface SiteInfo {
  origin: string; // e.g. https://www.example.com
  host: string; // bare host, e.g. example.com
  startUrl: string;
  robots: { found: boolean; disallow: string[]; sitemaps: string[] };
  sitemap: { found: boolean; urls: string[] };
  https: boolean;
}

export interface AffectedUrl {
  url: string;
  info?: string;
}

export interface Issue {
  id: string;
  severity: Severity;
  theme: Theme;
  title: string;
  why: string;
  fix: string;
  count: number;
  affected: AffectedUrl[];
}

import type { Report as HomepageReport } from "@/lib/grader/types";
export type { HomepageReport };

export interface SpeedSummary {
  performance: number;
  lcpMs: number | null;
  category: string | null;
}

export interface Comparison {
  prevId: string;
  prevDate: string;
  prevHealth: number;
  prevCounts: { errors: number; warnings: number; notices: number };
  prevIssues: Record<string, number>; // issue id -> count last time
}

export interface AuditReport {
  id: string;
  host: string;
  startUrl: string;
  createdAt: string;
  pagesCrawled: number;
  /** Sitemap coverage: how many sitemap URLs were crawled */
  sitemapTotal?: number;
  sitemapCrawled?: number;
  maxPages: number;
  limitReached: boolean;
  health: number;
  counts: { errors: number; warnings: number; notices: number };
  themes: { name: Theme; score: number }[];
  issues: Issue[];
  pages: {
    url: string;
    status: number;
    depth: number | null;
    ms: number;
    title: string;
    words: number;
    inlinks: number;
    errors: number;
    warnings: number;
  }[];
  speed: SpeedSummary | null;
  /** Pages that returned a bot check instead of content (not scored) */
  challenged: number;
  /** In-depth homepage check (Google speed test, Business Profile, local signals) */
  homepage?: HomepageReport | null;
  /** Same homepage check for a competitor, if one was entered */
  competitor?: HomepageReport | null;
  compare: Comparison | null;
  saved: boolean;
}

export interface LinkStatus {
  url: string;
  status: number; // 0 = unreachable
}
