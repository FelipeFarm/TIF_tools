import { MAX_PAGINATION_PER_PATH } from "./config";
import { isDisallowed, isInternal, isPaginated, looksLikeHtml, toOrigin } from "./urls";

export interface QueueItem {
  url: string;
  depth: number | null;
}

/**
 * Crawl order, so the pages that matter are never skipped when the page limit is hit:
 *   0 homepage
 *   1 pages linked from the homepage + every sitemap page
 *   2 pages two clicks deep
 *   3 deeper pages
 *   4 pagination / filter URLs (only a few per listing)
 * Click depth for the report is computed from the link graph afterwards, so this order doesn't distort it.
 */
export class CrawlQueue {
  private buckets: QueueItem[][] = [[], [], [], [], []];
  private seen = new Set<string>();
  private pagedPerPath = new Map<string, number>();
  private sitemap: Set<string>;
  readonly blocked: string[] = [];

  constructor(
    private host: string,
    private disallow: string[],
    sitemapUrls: string[],
    /** The site's real origin; www/non-www and http/https variants are folded onto it */
    private origin?: string
  ) {
    this.sitemap = new Set(sitemapUrls.map((u) => this.norm(u)));
  }

  private norm(url: string) {
    return this.origin ? toOrigin(url, this.origin) : url;
  }

  markSeen(url: string) {
    this.seen.add(this.norm(url));
  }

  add(rawUrl: string, depth: number | null) {
    const url = this.norm(rawUrl);
    if (this.seen.has(url)) return;
    this.seen.add(url);
    if (!isInternal(url, this.host) || !looksLikeHtml(url)) return;
    if (isDisallowed(url, this.disallow)) {
      if (this.blocked.length < 500) this.blocked.push(url);
      return;
    }
    const paged = isPaginated(url);
    if (paged) {
      const key = new URL(url).pathname;
      const n = this.pagedPerPath.get(key) ?? 0;
      if (n >= MAX_PAGINATION_PER_PATH) return;
      this.pagedPerPath.set(key, n + 1);
    }
    let hasQuery = false;
    try {
      hasQuery = !!new URL(url).search;
    } catch {
      /* ignore */
    }
    const b = depth === 0 ? 0 : paged || hasQuery ? 4 : this.sitemap.has(url) || (depth !== null && depth <= 1) ? 1 : depth === 2 ? 2 : 3;
    this.buckets[b].push({ url, depth });
  }

  next(n: number): QueueItem[] {
    const out: QueueItem[] = [];
    for (const q of this.buckets) while (q.length && out.length < n) out.push(q.shift()!);
    return out;
  }

  get size() {
    return this.buckets.reduce((s, q) => s + q.length, 0);
  }
}
