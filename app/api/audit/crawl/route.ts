import { fetchPage, pool } from "@/lib/audit/fetcher";
import { CRAWL_BATCH } from "@/lib/audit/config";
import { isInternal } from "@/lib/audit/urls";
import { normalizeUrl } from "@/lib/grader/net";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const host = String(body?.host ?? "");
  const list: { url: string; depth: number | null }[] = Array.isArray(body?.pages) ? body.pages.slice(0, CRAWL_BATCH) : [];
  if (!host || !list.length) return Response.json({ error: "Invalid request." }, { status: 400 });
  // Only crawl pages on the site being audited
  const valid = list.filter((p) => typeof p?.url === "string" && normalizeUrl(p.url) && isInternal(p.url, host));
  const pages = await pool(valid, 4, (p) => fetchPage(p.url, host, typeof p.depth === "number" ? p.depth : null));
  return Response.json({ pages });
}
