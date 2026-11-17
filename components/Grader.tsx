"use client";

import { useEffect, useRef, useState } from "react";
import LeadForm from "./LeadForm";
import { withBase, BOOKING_URL } from "@/lib/basePath";
import type { Report } from "@/lib/grader/types";

interface Result {
  you: Report;
  competitor: Report | null;
  competitorError?: string;
}

const ICON = { pass: "✓", warn: "!", fail: "✕" } as const;
const UNLOCK_KEY = "tif_grader_unlocked";

function scoreColor(score: number) {
  if (score >= 80) return "var(--good)";
  if (score >= 60) return "var(--warn)";
  return "var(--bad)";
}

function ScoreRing({ score, grade, label, sub, small }: { score: number; grade: string; label: string; sub?: string; small?: boolean }) {
  return (
    <div className={`ring-wrap${small ? " small" : ""}`}>
      <div className="score" style={{ background: `conic-gradient(${scoreColor(score)} ${score * 3.6}deg, #eeeeee 0)` }}>
        <div className="score-inner">
          <div className="n">{score}</div>
          <div className="g">Grade {grade}</div>
        </div>
      </div>
      <div className="ring-label">
        <span>{label}</span>
        {sub && <strong>{sub}</strong>}
      </div>
    </div>
  );
}

function stepsFor(hasCompetitor: boolean) {
  return [
    "Loading the homepage",
    "Checking SEO basics and mobile setup",
    "Looking up the Google Business Profile",
    "Running Google's mobile speed test",
    ...(hasCompetitor ? ["Grading your competitor"] : []),
    "Building your report",
  ];
}

export default function Grader() {
  const [url, setUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const steps = stepsFor(showCompare && !!competitorUrl.trim());

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    // Advance through the steps, holding on the speed test (the slow one)
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 2)), 3500);
    return () => clearInterval(t);
  }, [loading, steps.length]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(withBase("/api/grade"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          businessName,
          competitorUrl: showCompare ? competitorUrl : "",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || "Our grader hit a snag. Please try again in a minute.");
      setResult(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function unlock() {
    setUnlocked(true);
    setJustUnlocked(true);
    try {
      localStorage.setItem(UNLOCK_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  }

  const you = result?.you;
  const them = result?.competitor ?? null;
  const themById = new Map(them?.checks.map((c) => [c.id, c]) ?? []);
  const issues = you ? you.counts.fail + you.counts.warn : 0;

  return (
    <>
      <form className="card" onSubmit={run}>
        <div className="row2">
          <div className="field">
            <label htmlFor="url">Your website</label>
            <input
              id="url"
              type="text"
              inputMode="url"
              placeholder="yourbusiness.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="field">
            <label htmlFor="biz">
              Business name & city <span className="opt-label">optional</span>
            </label>
            <input
              id="biz"
              type="text"
              placeholder="Smith Plumbing, Katy TX"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              disabled={loading}
            />
            <p className="hint" style={{ marginTop: 6, marginBottom: 0 }}>
              Helps us find your Google Business Profile.
            </p>
          </div>
        </div>

        {showCompare ? (
          <div className="field">
            <label htmlFor="comp">
              Competitor&apos;s website <span className="opt-label">optional</span>
            </label>
            <input
              id="comp"
              type="text"
              inputMode="url"
              placeholder="competitor.com"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              disabled={loading}
            />
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setShowCompare(true)} disabled={loading}>
            + Compare against a competitor
          </button>
        )}

        <div className="actions" style={{ marginTop: 18 }}>
          <button className="btn" type="submit" disabled={loading || !url.trim()}>
            {loading ? (
              <>
                <span className="spin" /> Grading…
              </>
            ) : showCompare && competitorUrl.trim() ? (
              "Grade & compare"
            ) : (
              "Grade my website"
            )}
          </button>
        </div>
        {error && <p className="error">{error}</p>}

        {loading && (
          <div className="progress-steps" aria-live="polite">
            {steps.map((s, i) => (
              <div key={s} className={`pstep ${i < step ? "done" : i === step ? "active" : ""}`}>
                <span className="pdot">{i < step ? "✓" : ""}</span>
                {s}
              </div>
            ))}
            <p className="note" style={{ marginTop: 10 }}>
              Google&apos;s speed test loads your site on a real phone profile. It usually takes 20–40 seconds.
            </p>
          </div>
        )}
      </form>

      {you && (
        <div ref={resultsRef} className="grader-results">
          {/* ── Score summary ── */}
          <div className="card mt" aria-live="polite">
            <span className="badge">{them ? "Head-to-head report" : "Website report"}</span>
            <div className={`rings${them ? " two" : ""}`}>
              <ScoreRing score={you.score} grade={you.grade} label="Your site" sub={you.host} />
              {them && <div className="vs">vs</div>}
              {them && <ScoreRing score={them.score} grade={them.grade} label="Competitor" sub={them.host} />}
            </div>
            {them && (
              <p className="verdict">
                {you.score > them.score
                  ? `You're ahead by ${you.score - them.score} points. Here's how to widen the gap.`
                  : you.score < them.score
                    ? `${them.host} is ahead by ${them.score - you.score} points. Here's where they're beating you.`
                    : "You're neck and neck. Small fixes will decide who wins."}
              </p>
            )}
            {result?.competitorError && <p className="note">Competitor not graded: {result.competitorError}</p>}

            {/* Category bars */}
            <div className="cats">
              {you.categories.map((c) => {
                const t = them?.categories.find((x) => x.name === c.name);
                return (
                  <div className="cat" key={c.name}>
                    <div className="cat-name">{c.name}</div>
                    <div className="bars">
                      <div className="bar">
                        <div style={{ width: `${c.score}%`, background: scoreColor(c.score) }} />
                        <span>{c.score}</span>
                      </div>
                      {them && (
                        <div className="bar them">
                          <div style={{ width: `${t?.score ?? 0}%` }} />
                          <span>{t ? t.score : "—"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {them && (
                <div className="legend">
                  <span className="lg you" /> You <span className="lg them" /> {them.host}
                </div>
              )}
            </div>

            {/* Google speed snapshot */}
            {you.speed ? (
              <div className="stats">
                <div className="stat">
                  <div className="k">Google mobile speed</div>
                  <div className="v" style={{ color: scoreColor(you.speed.performance) }}>
                    {you.speed.performance}
                    <small>/100</small>
                  </div>
                </div>
                <div className="stat">
                  <div className="k">Main content loads in</div>
                  <div className="v">
                    {(((you.speed.field?.lcpMs ?? you.speed.lcpMs) || 0) / 1000).toFixed(1)}
                    <small>s</small>
                  </div>
                </div>
                <div className="stat">
                  <div className="k">Real visitors say</div>
                  <div className="v" style={{ fontSize: 20 }}>
                    {you.speed.field ? you.speed.field.category.charAt(0) + you.speed.field.category.slice(1).toLowerCase() : "Not enough data"}
                  </div>
                </div>
              </div>
            ) : (
              you.speedError && <p className="note">{you.speedError} Your score is based on the other checks.</p>
            )}
          </div>

          {/* ── Checks ── */}
          <div className="card mt">
            <div className="checks-head">
              <h2 style={{ margin: 0 }}>
                {you.counts.pass} passed · {issues} to fix
              </h2>
              {them && (
                <div className="col-labels" aria-hidden>
                  <span>You</span>
                  <span>Them</span>
                </div>
              )}
            </div>
            <div className="checks">
              {you.checks.map((c) => {
                const t = themById.get(c.id);
                return (
                  <div className={`check${them ? " vs-row" : ""}`} key={c.id}>
                    <div className={`dot ${c.status}`} aria-label={c.status}>
                      {ICON[c.status]}
                    </div>
                    <div className="check-body">
                      <div className="check-top">
                        <div className="t">
                          {c.title} <span className="cat-tag">{c.category}</span>
                        </div>
                        <div className="heads">
                          <span className={`hl ${c.status}`}>{c.headline}</span>
                          {them && <span className={`hl ${t?.status ?? "none"}`}>{t ? t.headline : "—"}</span>}
                        </div>
                      </div>
                      {unlocked ? (
                        <>
                          <div className="d">{c.detail}</div>
                          {c.fix && (
                            <div className="fix">
                              <strong>How to fix:</strong> {c.fix}
                            </div>
                          )}
                        </>
                      ) : c.status !== "pass" ? (
                        <a className="locked" href="#unlock">
                          <span className="blur-lines" aria-hidden>
                            <i />
                            <i />
                          </span>
                          <span className="lock-label">🔒 Unlock the fix</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="note">
              This check covers your homepage. A full audit looks at every page, backlinks, keyword rankings and your
              Google Business Profile in depth.
            </p>
          </div>

          {/* ── Gate ── */}
          {!unlocked ? (
            <LeadForm
              id="unlock"
              tool="website-grader"
              heading={`Unlock how to fix ${issues} issue${issues === 1 ? "" : "s"}`}
              sub="Get the full report with what we found and step-by-step fixes for every issue. Free, no obligation."
              cta="Unlock my full report"
              defaultWebsite={you.url}
              onSuccess={unlock}
              successTitle="Your full report is unlocked ↑"
              successBody="Scroll up to see what we found and how to fix each issue. Want us to handle the fixes for you?"
              details={{
                graded_url: you.url,
                score: you.score,
                grade: you.grade,
                google_speed: you.speed ? `${you.speed.performance}/100` : "n/a",
                google_business_profile: you.gbp ? `${you.gbp.status}${you.gbp.reviews != null ? ` (${you.gbp.rating ?? "-"}★, ${you.gbp.reviews} reviews)` : ""}` : "not checked",
                issues: you.checks
                  .filter((c) => c.status !== "pass")
                  .map((c) => c.title)
                  .join(", "),
                competitor: them ? `${them.host} scored ${them.score}` : "none",
              }}
            />
          ) : (
            <div className="card mt cta-card">
              {justUnlocked && (
                <div className="success" style={{ width: "100%" }}>
                  <strong>Thanks! Your full report is unlocked above.</strong> Each issue now shows what we found and how to
                  fix it.
                </div>
              )}
              <div>
                <h2>Want us to fix these for you?</h2>
                <p className="lede" style={{ fontSize: 16 }}>
                  Our team fixes SEO, speed and Google Business Profile issues every day. Book a free 20-minute call and
                  we&apos;ll walk through your report.
                </p>
              </div>
              <a className="btn" href={BOOKING_URL} target="_top">
                Book a free call
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
