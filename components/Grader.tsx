"use client";

import { useState } from "react";
import LeadForm from "./LeadForm";
import { withBase } from "@/lib/basePath";

interface Check {
  id: string;
  category: string;
  title: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}
interface Result {
  url: string;
  score: number;
  grade: string;
  counts: { pass: number; warn: number; fail: number };
  checks: Check[];
}

const ICON = { pass: "✓", warn: "!", fail: "✕" };

function scoreColor(score: number) {
  if (score >= 80) return "var(--good)";
  if (score >= 60) return "var(--warn)";
  return "var(--bad)";
}

export default function Grader() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(withBase("/api/grade"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || "Our grader hit a snag. Please try again in a minute.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="card" onSubmit={run}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="url">Your website</label>
          <input
            id="url"
            type="text"
            inputMode="url"
            placeholder="yourbusiness.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>
        <div className="actions">
          <button className="btn" type="submit" disabled={loading || !url.trim()}>
            {loading ? (
              <>
                <span className="spin" /> Checking…
              </>
            ) : (
              "Grade my website"
            )}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>

      {result && (
        <>
          <div className="card mt" aria-live="polite">
            <div className="result-head">
              <div
                className="score"
                style={{
                  background: `conic-gradient(${scoreColor(result.score)} ${result.score * 3.6}deg, #eeeeee 0)`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 10,
                    borderRadius: "50%",
                    background: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                  }}
                >
                  <div>
                    <div className="n">{result.score}</div>
                    <div className="g">Grade {result.grade}</div>
                  </div>
                </div>
              </div>
              <div>
                <span className="badge">Website report</span>
                <h2 style={{ margin: "10px 0 4px", wordBreak: "break-all" }}>{new URL(result.url).hostname}</h2>
                <p className="lede" style={{ fontSize: 15 }}>
                  {result.counts.pass} passed · {result.counts.warn} to improve · {result.counts.fail} to fix
                </p>
              </div>
            </div>
            <div className="checks">
              {result.checks.map((c) => (
                <div className="check" key={c.id}>
                  <div className={`dot ${c.status}`} aria-label={c.status}>
                    {ICON[c.status]}
                  </div>
                  <div>
                    <div className="t">
                      {c.title} <span className="note" style={{ margin: 0 }}>· {c.category}</span>
                    </div>
                    <div className="d">{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="note">
              This quick check looks at your homepage only. A full audit covers every page, Core Web Vitals, backlinks,
              Google Business Profile and how you rank against competitors.
            </p>
          </div>

          <LeadForm
            tool="website-grader"
            heading="Get the full audit, free"
            sub="We'll run a complete SEO and performance audit on your site and walk you through the fixes that matter most."
            cta="Send me the full audit"
            defaultWebsite={result.url}
            details={{
              graded_url: result.url,
              score: result.score,
              grade: result.grade,
              issues: result.checks
                .filter((c) => c.status !== "pass")
                .map((c) => c.title)
                .join(", "),
            }}
          />
        </>
      )}
    </>
  );
}
