import { loadAudit } from "@/lib/audit/storage";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const report = await loadAudit(id);
  if (!report) return Response.json({ error: "We couldn't find that audit. It may have been run before reports were saved." }, { status: 404 });
  return Response.json({ report });
}
