/**
 * Site Audit limits. The public tool crawls up to 100 pages.
 * For a future internal/team mode, raise AUDIT_MAX_PAGES (env) behind a login.
 */
export const DEFAULT_MAX_PAGES = 100;
export const HARD_MAX_PAGES = 1000;

export function maxPages(): number {
  const n = Number(process.env.AUDIT_MAX_PAGES);
  return Number.isFinite(n) && n > 0 ? Math.min(n, HARD_MAX_PAGES) : DEFAULT_MAX_PAGES;
}

/** Pages fetched per /api/audit/crawl call (keeps each request well under Cloudflare's subrequest limit) */
export const CRAWL_BATCH = 6;
/** URLs checked per /api/audit/check-links call */
export const LINK_BATCH = 15;
/** Max external links + images to status-check per audit */
export const MAX_LINK_CHECKS = 150;
/** Max sitemap URLs to read */
export const MAX_SITEMAP_URLS = 500;
/** Affected URLs kept per issue in the saved report */
export const MAX_AFFECTED = 100;

export const SLOW_MS = 1500;
export const LOW_WORDS = 200;
export const LARGE_HTML_BYTES = 500 * 1024;
export const DEEP_DEPTH = 3;
