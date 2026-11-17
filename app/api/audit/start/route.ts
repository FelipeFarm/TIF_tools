import { discover } from "@/lib/audit/fetcher";
import { CRAWL_BATCH, LINK_BATCH, MAX_LINK_CHECKS, maxPages } from "@/lib/audit/config";
import { getDb } from "@/lib/audit/storage";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const url = String(body?.url ?? "").trim();
  if (!url) return Response.json({ error: "Please enter your website address." }, { status: 400 });
  try {
    const site = await discover(url);
    return Response.json({
      site,
      limits: { maxPages: maxPages(), crawlBatch: CRAWL_BATCH, linkBatch: LINK_BATCH, maxLinkChecks: MAX_LINK_CHECKS },
      storage: !!getDb(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!/valid public|returned an error|couldn't reach/.test(msg)) console.error("[audit/start]", err);
    return Response.json({ error: msg || "We couldn't start the audit. Please try again." }, { status: 400 });
  }
}
