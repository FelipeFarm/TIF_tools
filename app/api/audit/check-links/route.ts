import { checkLink, pool } from "@/lib/audit/fetcher";
import { LINK_BATCH } from "@/lib/audit/config";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter((u: unknown) => typeof u === "string").slice(0, LINK_BATCH) : [];
  if (!urls.length) return Response.json({ links: [] });
  const links = await pool(urls, 8, checkLink);
  return Response.json({ links });
}
