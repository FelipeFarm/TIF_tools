import { gradeSite } from "@/lib/grader/grade";
import { GradeError, bareHost, normalizeUrl } from "@/lib/grader/net";

// Note: no `export const runtime = "edge"`. With Next.js 16 on Webflow Cloud it makes API routes return 500.

export async function POST(req: Request) {
  let body: { url?: unknown; competitorUrl?: unknown; businessName?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const url = String(body.url ?? "").trim();
  const competitorUrl = String(body.competitorUrl ?? "").trim();
  const businessName = String(body.businessName ?? "").trim().slice(0, 120);

  if (!url) return Response.json({ error: "Please enter your website address." }, { status: 400 });
  if (competitorUrl) {
    const a = normalizeUrl(url);
    const b = normalizeUrl(competitorUrl);
    if (a && b && bareHost(a.hostname) === bareHost(b.hostname)) {
      return Response.json({ error: "Your site and the competitor's site are the same. Enter a different competitor." }, { status: 400 });
    }
  }

  // Grade both sites at the same time
  const [you, them] = await Promise.allSettled([
    gradeSite(url, { businessName }),
    competitorUrl ? gradeSite(competitorUrl) : Promise.resolve(null),
  ]);

  if (you.status === "rejected") {
    const err = you.reason;
    if (err instanceof GradeError) return Response.json({ error: err.message }, { status: err.status });
    console.error("[grade] failed", err);
    return Response.json({ error: "Our grader hit a snag. Please try again in a minute." }, { status: 500 });
  }

  let competitor = null;
  let competitorError: string | undefined;
  if (them.status === "fulfilled") competitor = them.value;
  else {
    competitorError = them.reason instanceof GradeError ? them.reason.message : "We couldn't check the competitor's site.";
    if (!(them.reason instanceof GradeError)) console.error("[grade] competitor failed", them.reason);
  }

  return Response.json({ you: you.value, competitor, competitorError });
}
