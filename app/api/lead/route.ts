
const TOOLS = new Set(["seo-plan-picker", "ad-budget-estimator", "website-grader", "site-audit"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Turn the tool's answers into readable "Key: value" lines for the GHL contact note */
function summarize(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("\n")
    .slice(0, 4000);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const tool = clean(body.tool, 40);
  const email = clean(body.email, 200).toLowerCase();
  const firstName = clean(body.firstName, 80);

  if (!TOOLS.has(tool)) return Response.json({ error: "Unknown tool." }, { status: 400 });
  if (!firstName) return Response.json({ error: "Please add your first name." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return Response.json({ error: "Please enter a valid email." }, { status: 400 });

  // Flat payload: easy to map in a GHL "Inbound Webhook" workflow trigger.
  const payload = {
    first_name: firstName,
    last_name: clean(body.lastName, 80),
    email,
    phone: clean(body.phone, 40),
    company_name: clean(body.business, 120),
    website: clean(body.website, 200),
    source: `TIF Tools - ${tool}`,
    tags: ["tif-tools", tool],
    tool,
    tool_summary: summarize(body.details),
    tool_details: body.details ?? {},
    page_url: clean(body.page, 500),
    submitted_at: new Date().toISOString(),
  };

  const webhook = process.env.GHL_WEBHOOK_URL;
  if (!webhook) {
    // Not configured yet (e.g. first test deploy). Log so it shows in Webflow Cloud logs.
    console.warn("[lead] GHL_WEBHOOK_URL not set; lead not forwarded", { tool, email });
    return Response.json({ ok: true, forwarded: false });
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[lead] GHL webhook error", res.status);
      return Response.json({ error: "We couldn't send that right now. Please try again." }, { status: 502 });
    }
  } catch (err) {
    console.error("[lead] GHL webhook failed", err);
    return Response.json({ error: "We couldn't send that right now. Please try again." }, { status: 502 });
  }

  return Response.json({ ok: true, forwarded: true });
}
