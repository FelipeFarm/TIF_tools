import { buildReport } from "@/lib/audit/issues";
import { maxPages } from "@/lib/audit/config";
import { previousAudit, saveAudit } from "@/lib/audit/storage";
import type { AuditReport, HomepageReport, LinkStatus, PageRecord, SiteInfo, SpeedSummary } from "@/lib/audit/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const site = body?.site as SiteInfo | undefined;
  const pages = (Array.isArray(body?.pages) ? body.pages : []) as PageRecord[];
  const max = maxPages();
  if (!site?.host || !site.origin || !pages.length) return Response.json({ error: "Invalid audit data." }, { status: 400 });
  if (pages.length > max + 10) return Response.json({ error: "Too many pages for one audit." }, { status: 400 });

  try {
    const core = buildReport({
      site,
      pages,
      links: (Array.isArray(body?.links) ? body.links : []).slice(0, 2000) as LinkStatus[],
      blocked: (Array.isArray(body?.blocked) ? body.blocked : []).slice(0, 500) as string[],
      speed: (body?.speed ?? null) as SpeedSummary | null,
      maxPages: max,
      limitReached: !!body?.limitReached,
      homepage: validHomepage(body?.homepage),
      competitor: validHomepage(body?.competitor),
    });
    const compare = await previousAudit(core.host);
    const report: AuditReport = { ...core, id: crypto.randomUUID(), createdAt: new Date().toISOString(), compare, saved: false };
    report.saved = await saveAudit(report);
    return Response.json({ report });
  } catch (err) {
    console.error("[audit/finish]", err);
    return Response.json({ error: "We couldn't build the report. Please try again." }, { status: 500 });
  }
}

/** Light shape check on the homepage report sent back by the browser */
function validHomepage(v: unknown): HomepageReport | null {
  const r = v as HomepageReport | null;
  return r && typeof r.score === "number" && Array.isArray(r.checks) && r.checks.length < 60 ? r : null;
}
