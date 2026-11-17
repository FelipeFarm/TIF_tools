import { runPsi } from "@/lib/grader/psi";
import { normalizeUrl } from "@/lib/grader/net";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const url = normalizeUrl(String(body?.url ?? ""));
  if (!url) return Response.json({ speed: null });
  const { data } = await runPsi(url.toString(), process.env.GOOGLE_API_KEY || undefined);
  return Response.json({
    speed: data ? { performance: data.performance, lcpMs: data.field?.lcpMs ?? data.lcpMs, category: data.field?.category ?? null } : null,
  });
}
