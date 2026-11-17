"use client";

import { useEffect, useRef, useState } from "react";
import LeadForm from "./LeadForm";
import { withBase, BOOKING_URL } from "@/lib/basePath";
import { ISSUE_INFO } from "@/lib/audit/issues";
import { isDisallowed, isInternal, looksLikeHtml, pathOf } from "@/lib/audit/urls";
import type { AuditReport, HomepageReport, Issue, LinkStatus, PageRecord, Severity, SiteInfo, SpeedSummary } from "@/lib/audit/types";

const UNLOCK_KEY = "tif_grader_unlocked"; // same key the old Website Grader used, so people who already unlocked stay unlocked
const SEV_LABEL: Record<Severity, string> = { error: "Errors", warning: "Warnings", notice: "Notices" };
const SEV_ICON: Record<Severity, string> = { error: "✕", warning: "!", notice: "i" };

type Phase = "idle" | "starting" | "crawling" | "links" | "finishing" | "done";

interface Limits {
  maxPages: number;
  crawlBatch: number;
  linkBatch: number;
  maxLinkChecks: number;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(withBase(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || "Our auditor hit a snag. Please try again in a minute.");
  return data as T;
}

function healthColor(n: number) {
  if (n >= 80) return "var(--good)";
  if (n >= 60) return "var(--warn)";
  return "var(--bad)";
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function Delta({ now, prev, lowerIsBetter = true, suffix = "" }: { now: number; prev: number | undefined; lowerIsBetter?: boolean; suffix?: string }) {
  if (prev === undefined) return null;
  const d = now - prev;
  if (d === 0) return <span className="delta same">no change</span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return (
    <span className={`delta ${good ? "up" : "down"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)}
      {suffix}
    </span>
  );
}

export default function SiteAudit() {
  const [url, setUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [gradeState, setGradeState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [compError, setCompError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [prog, setProg] = useState({ crawled: 0, max: 100, broken: 0, current: "", linksDone: 0, linksTotal: 0 });
  const [report, setReport] = useState<AuditReport | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [tab, setTab] = useState<"issues" | "pages">("issues");
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const cancelled = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {
      /* storage unavailable */
    }
    // Open a saved report from ?id=
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      setPhase("finishing");
      fetch(withBase(`/api/audit/report?id=${encodeURIComponent(id)}`))
        .then((r) => r.json())
        .then((d) => {
          if (d?.report) {
            setReport(d.report);
            setUrl(d.report.host);
            if (d.report.competitor?.url) {
              setCompetitorUrl(d.report.competitor.url);
              setShowCompare(true);
            }
            setPhase("done");
          } else {
            setError(d?.error || "We couldn't find that audit.");
            setPhase("idle");
          }
        })
        .catch(() => {
          setError("We couldn't load that audit.");
          setPhase("idle");
        });
    }
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function run(target: string) {
    cancelled.current = false;
    setError("");
    setReport(null);
    setOpen({});
    setFilter("all");
    setTab("issues");
    setPhase("starting");
    try {
      const { site, limits } = await post<{ site: SiteInfo; limits: Limits }>("/api/audit/start", { url: target });
      setSite(site);
      const max = limits.maxPages;
      setProg({ crawled: 0, max, broken: 0, current: site.startUrl, linksDone: 0, linksTotal: 0 });

      // In-depth homepage check runs alongside the crawl:
      // Google speed test, Business Profile, local signals, and the competitor (if any)
      setGradeState("running");
      setCompError("");
      const comp = showCompare ? competitorUrl.trim() : "";
      const gradeP = post<{ you: HomepageReport; competitor: HomepageReport | null; competitorError?: string }>("/api/grade", {
        url: site.startUrl,
        businessName,
        competitorUrl: comp,
      })
        .then((d) => {
          setGradeState("done");
          if (d.competitorError) setCompError(d.competitorError);
          return d;
        })
        .catch((e) => {
          setGradeState("failed");
          if (comp) setCompError(e instanceof Error ? e.message : "We couldn't check the competitor.");
          return null;
        });

      /* ── Crawl (breadth-first from the homepage, then sitemap-only URLs) ── */
      setPhase("crawling");
      const seen = new Set<string>([site.startUrl]);
      const queue: { url: string; depth: number | null }[] = [{ url: site.startUrl, depth: 0 }];
      const sitemapLeft = site.sitemap.urls.filter((u) => looksLikeHtml(u));
      const pages: PageRecord[] = [];
      const blocked: string[] = [];
      let broken = 0;
      const enqueue = (u: string, depth: number | null) => {
        if (seen.has(u)) return;
        seen.add(u);
        if (!isInternal(u, site.host) || !looksLikeHtml(u)) return;
        if (isDisallowed(u, site.robots.disallow)) {
          if (blocked.length < 500) blocked.push(u);
          return;
        }
        queue.push({ url: u, depth });
      };

      while (pages.length < max && !cancelled.current) {
        if (!queue.length) {
          // Nothing left to follow: crawl sitemap URLs nobody links to (orphan candidates)
          while (sitemapLeft.length && queue.length < limits.crawlBatch * 2) {
            const u = sitemapLeft.shift()!;
            if (!seen.has(u) && !isDisallowed(u, site.robots.disallow)) {
              seen.add(u);
              queue.push({ url: u, depth: null });
            }
          }
          if (!queue.length) break;
        }
        // One batch at a time keeps the crawl gentle on small business hosts
        const batch = queue.splice(0, Math.min(limits.crawlBatch, max - pages.length));
        setProg((p) => ({ ...p, current: batch[0]?.url || p.current }));
        const results = await post<{ pages: PageRecord[] }>("/api/audit/crawl", { host: site.host, pages: batch })
          .then((d) => d.pages)
          .catch(() => [] as PageRecord[]);
        let challenged = 0;
        for (const rec of results) {
          if (pages.length >= max) break;
          pages.push(rec);
          seen.add(rec.finalUrl);
          if (rec.challenge) challenged++;
          if (rec.status >= 400 || rec.status === 0) broken++;
          if (rec.status === 200 && rec.internalLinks) {
            const next = rec.depth === null ? null : rec.depth + 1;
            for (const l of rec.internalLinks) enqueue(l.url, next);
          }
        }
        // The site started showing bot checks: slow down
        if (challenged) await new Promise((res) => setTimeout(res, 2000));
        setProg((p) => ({ ...p, crawled: pages.length, broken }));
      }
      if (cancelled.current) return;
      const limitReached = pages.length >= max && (queue.length > 0 || sitemapLeft.some((u) => !seen.has(u)));

      /* ── Check external links, images and internal files ── */
      setPhase("links");
      const crawled = new Set(pages.flatMap((p) => [p.url, p.finalUrl]));
      const internalFiles = new Set<string>();
      const images = new Set<string>();
      const external = new Set<string>();
      for (const p of pages) {
        for (const l of p.internalLinks ?? []) if (!crawled.has(l.url) && !looksLikeHtml(l.url)) internalFiles.add(l.url);
        for (const i of p.images ?? []) images.add(i.src);
        for (const e of p.externalLinks ?? []) external.add(e);
      }
      const toCheck = [...internalFiles, ...images, ...external].slice(0, limits.maxLinkChecks);
      setProg((p) => ({ ...p, linksDone: 0, linksTotal: toCheck.length }));
      const links: LinkStatus[] = [];
      for (let i = 0; i < toCheck.length && !cancelled.current; i += limits.linkBatch * 2) {
        const chunks = [toCheck.slice(i, i + limits.linkBatch), toCheck.slice(i + limits.linkBatch, i + limits.linkBatch * 2)].filter((c) => c.length);
        const res = await Promise.all(chunks.map((c) => post<{ links: LinkStatus[] }>("/api/audit/check-links", { urls: c }).then((d) => d.links).catch(() => [])));
        links.push(...res.flat());
        setProg((p) => ({ ...p, linksDone: Math.min(toCheck.length, i + limits.linkBatch * 2) }));
      }
      if (cancelled.current) return;

      /* ── Build + save the report ── */
      setPhase("finishing");
      const grade = await Promise.race([gradeP, new Promise<null>((r) => setTimeout(() => r(null), 60_000))]);
      const hs = grade?.you.speed;
      const speed: SpeedSummary | null = hs ? { performance: hs.performance, lcpMs: hs.field?.lcpMs ?? hs.lcpMs, category: hs.field?.category ?? null } : null;
      const { report } = await post<{ report: AuditReport }>("/api/audit/finish", {
        site,
        pages,
        links,
        blocked,
        speed,
        limitReached,
        homepage: grade?.you ?? null,
        competitor: grade?.competitor ?? null,
      });
      setReport(report);
      setPhase("done");
      if (report.saved) {
        const u = new URL(window.location.href);
        u.searchParams.set("id", report.id);
        window.history.replaceState(null, "", u.toString());
      }
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
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

  function reset() {
    cancelled.current = true;
    setReport(null);
    setPhase("idle");
    const u = new URL(window.location.href);
    u.searchParams.delete("id");
    window.history.replaceState(null, "", u.toString());
  }

  const busy = phase !== "idle" && phase !== "done";
  const steps: { key: Phase | "speed"; label: string }[] = [
    { key: "starting", label: "Reading robots.txt and sitemap" },
    { key: "crawling", label: "Crawling pages" },
    { key: "links", label: "Checking links and images" },
    { key: "finishing", label: "Building your report" },
  ];
  const order: Phase[] = ["starting", "crawling", "links", "finishing", "done"];
  const phaseIdx = order.indexOf(phase);

  /* ───────────── Render ───────────── */
  if (!report) {
    return (
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          run(url);
        }}
      >
        <div className="row2">
          <div className="field">
            <label htmlFor="audit-url">Your website</label>
            <input
              id="audit-url"
              type="text"
              inputMode="url"
              placeholder="yourbusiness.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="audit-biz">
              Business name & city <span className="opt-label">optional</span>
            </label>
            <input
              id="audit-biz"
              type="text"
              placeholder="Smith Plumbing, Katy TX"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              disabled={busy}
            />
            <p className="hint" style={{ marginTop: 6, marginBottom: 0 }}>
              Helps us find your Google Business Profile.
            </p>
          </div>
        </div>
        {showCompare ? (
          <div className="field">
            <label htmlFor="audit-comp">
              Competitor&apos;s website <span className="opt-label">optional</span>
            </label>
            <input
              id="audit-comp"
              type="text"
              inputMode="url"
              placeholder="competitor.com"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              disabled={busy}
            />
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setShowCompare(true)} disabled={busy}>
            + Compare against a competitor
          </button>
        )}
        <div className="actions" style={{ marginTop: 18 }}>
          <button className="btn" type="submit" disabled={busy || !url.trim()}>
            {busy ? (
              <>
                <span className="spin" /> Auditing…
              </>
            ) : showCompare && competitorUrl.trim() ? (
              "Audit & compare"
            ) : (
              "Start site audit"
            )}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          We crawl up to 100 pages, run Google&apos;s speed test and 50+ checks. Most sites finish in 1–2 minutes.
        </p>
        {error && <p className="error">{error}</p>}

        {busy && (
          <div className="progress-steps" aria-live="polite">
            {steps.map((s, i) => {
              const state = i < phaseIdx ? "done" : i === phaseIdx ? "active" : "";
              return (
                <div key={s.key} className={`pstep ${state}`}>
                  <span className="pdot">{state === "done" ? "✓" : ""}</span>
                  <span style={{ flex: 1 }}>
                    {s.label}
                    {s.key === "starting" && site && state === "done" && (
                      <span className="pmeta">
                        {site.sitemap.found ? `sitemap: ${site.sitemap.urls.length} URLs` : "no sitemap found"}
                      </span>
                    )}
                    {s.key === "crawling" && phaseIdx >= 1 && (
                      <span className="pmeta">
                        {prog.crawled} pages{prog.broken ? ` · ${prog.broken} broken so far` : ""}
                      </span>
                    )}
                    {s.key === "links" && phaseIdx >= 2 && prog.linksTotal > 0 && (
                      <span className="pmeta">
                        {prog.linksDone} / {prog.linksTotal}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {gradeState !== "idle" && (
              <div className={`pstep ${gradeState === "running" ? "active" : "done"} parallel`}>
                <span className="pdot">{gradeState === "running" ? "" : "✓"}</span>
                <span style={{ flex: 1 }}>
                  Google speed test & Business Profile{showCompare && competitorUrl.trim() ? " (you and your competitor)" : ""}
                  <span className="pmeta">{gradeState === "running" ? "running alongside the crawl" : gradeState === "failed" ? "unavailable" : "done"}</span>
                </span>
              </div>
            )}
            {phase === "crawling" && (
              <>
                <div className="crawl-bar">
                  <div style={{ width: `${Math.max(3, (prog.crawled / prog.max) * 100)}%` }} />
                </div>
                <p className="crawl-current">{pathOf(prog.current)}</p>
              </>
            )}
            {phase === "links" && prog.linksTotal > 0 && (
              <div className="crawl-bar">
                <div style={{ width: `${(prog.linksDone / prog.linksTotal) * 100}%` }} />
              </div>
            )}
          </div>
        )}
      </form>
    );
  }

  const r = report;
  const c = r.compare;
  const issues = filter === "all" ? r.issues : r.issues.filter((i) => i.severity === filter);
  const fixed = c ? Object.entries(c.prevIssues).filter(([id]) => !r.issues.some((i) => i.id === id)) : [];
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const errWarnIssues = r.issues.filter((i) => i.severity !== "notice").length;

  return (
    <div ref={topRef} className="grader-results">
      {/* ── Overview ── */}
      <div className="card">
        <div className="audit-head">
          <div>
            <span className="badge">Site Audit</span>
            <h2 style={{ margin: "10px 0 2px", wordBreak: "break-all" }}>{r.host}</h2>
            <p className="note" style={{ margin: 0 }}>
              {fmtDate(r.createdAt)} · {r.pagesCrawled} pages crawled
              {r.limitReached ? ` (limit of ${r.maxPages} reached)` : ""}
              {c ? ` · compared with ${fmtDate(c.prevDate)}` : ""}
            </p>
            {r.challenged > 0 && (
              <p className="note warn-note">
                {r.challenged} page{r.challenged === 1 ? " was" : "s were"} behind bot protection and couldn&apos;t be audited. They&apos;re not counted in
                the score.
              </p>
            )}
          </div>
          <div className="audit-actions">
            <button className="btn ghost" type="button" onClick={() => run(r.startUrl)}>
              Re-audit
            </button>
            {r.saved && (
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(shareUrl).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  });
                }}
              >
                {copied ? "Link copied" : "Copy report link"}
              </button>
            )}
            <button className="link-btn" type="button" onClick={reset}>
              New audit
            </button>
          </div>
        </div>

        <div className="audit-overview">
          <div className="health">
            <div className="score big" style={{ background: `conic-gradient(${healthColor(r.health)} ${r.health * 3.6}deg, #eeeeee 0)` }}>
              <div className="score-inner">
                <div>
                  <div className="n">{r.health}%</div>
                  <div className="g">Site Health</div>
                </div>
              </div>
            </div>
            {c && <Delta now={r.health} prev={c.prevHealth} lowerIsBetter={false} suffix=" pts" />}
          </div>
          <div className="sev-tiles">
            {(["error", "warning", "notice"] as Severity[]).map((s) => {
              const key = (s + "s") as "errors" | "warnings" | "notices";
              return (
                <button
                  type="button"
                  key={s}
                  className={`sev-tile ${s}${filter === s ? " on" : ""}`}
                  onClick={() => {
                    setTab("issues");
                    setFilter(filter === s ? "all" : s);
                  }}
                >
                  <span className="k">{SEV_LABEL[s]}</span>
                  <span className="v">{r.counts[key]}</span>
                  {c && <Delta now={r.counts[key]} prev={c.prevCounts[key]} />}
                </button>
              );
            })}
            <div className="sev-tile neutral">
              <span className="k">Pages crawled</span>
              <span className="v">{r.pagesCrawled}</span>
              {r.speed && (
                <span className="delta same">
                  Mobile speed {r.speed.performance}/100
                </span>
              )}
            </div>
          </div>
        </div>

        <h3 style={{ marginTop: 26 }}>Thematic reports</h3>
        <div className="themes">
          {r.themes.map((t) => (
            <div className="theme" key={t.name}>
              <div className="theme-top">
                <span>{t.name}</span>
                <strong style={{ color: healthColor(t.score) }}>{t.score}%</strong>
              </div>
              <div className="bar">
                <div style={{ width: `${t.score}%`, background: healthColor(t.score) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Local & speed snapshot (in-depth homepage check) ── */}
      {r.homepage && <Snapshot you={r.homepage} them={r.competitor ?? null} compError={compError} />}

      {/* ── Tabs ── */}
      <div className="card mt">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "issues"} className={tab === "issues" ? "on" : ""} onClick={() => setTab("issues")}>
            Issues <span>{r.issues.length}</span>
          </button>
          <button role="tab" aria-selected={tab === "pages"} className={tab === "pages" ? "on" : ""} onClick={() => setTab("pages")}>
            Crawled pages <span>{r.pages.length}</span>
          </button>
        </div>

        {tab === "issues" ? (
          <>
            <div className="chips">
              {(["all", "error", "warning", "notice"] as const).map((f) => (
                <button key={f} type="button" className={`chip ${f}${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : SEV_LABEL[f]} ({f === "all" ? r.issues.length : r.issues.filter((i) => i.severity === f).length})
                </button>
              ))}
            </div>

            {issues.length === 0 && <p className="note">No issues in this category. Nice work.</p>}
            <div className="issue-list">
              {issues.map((i: Issue) => {
                const prev = c?.prevIssues[i.id];
                const isOpen = !!open[i.id];
                return (
                  <div className={`issue ${i.severity}${isOpen ? " open" : ""}`} key={i.id}>
                    <button type="button" className="issue-row" onClick={() => setOpen({ ...open, [i.id]: !isOpen })} aria-expanded={isOpen}>
                      <span className={`sev ${i.severity}`} aria-label={i.severity}>
                        {SEV_ICON[i.severity]}
                      </span>
                      <span className="issue-title">
                        {i.title}
                        <span className="cat-tag">{i.theme}</span>
                      </span>
                      <span className="issue-count">
                        {i.count} {i.count === 1 ? "page" : "pages"}
                        {c && (prev === undefined ? <span className="delta down">new</span> : <Delta now={i.count} prev={prev} />)}
                      </span>
                      <span className="chev" aria-hidden>
                        ▾
                      </span>
                    </button>
                    {isOpen && (
                      <div className="issue-body">
                        <p>
                          <strong>Why it matters:</strong> {i.why}
                        </p>
                        {unlocked ? (
                          <>
                            <div className="fix">
                              <strong>How to fix:</strong> {i.fix}
                            </div>
                            <ul className="affected">
                              {i.affected.map((a) => (
                                <li key={a.url}>
                                  <a href={a.url} target="_blank" rel="noopener noreferrer">
                                    {pathOf(a.url)}
                                  </a>
                                  {a.info && <span>{a.info}</span>}
                                </li>
                              ))}
                              {i.count > i.affected.length && <li className="note">+ {i.count - i.affected.length} more</li>}
                            </ul>
                          </>
                        ) : (
                          <a className="locked" href="#unlock">
                            <span className="blur-lines" aria-hidden>
                              <i />
                              <i />
                            </span>
                            <span className="lock-label">🔒 Unlock the fix and the {i.count} affected URL{i.count === 1 ? "" : "s"}</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {fixed.length > 0 && (
              <div className="fixed-box">
                <h3>Fixed since {fmtDate(c!.prevDate)} 🎉</h3>
                <ul>
                  {fixed.map(([id, n]) => (
                    <li key={id}>
                      <span className="sev pass">✓</span> {ISSUE_INFO[id]?.title ?? id} <span className="note">(was {n})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="pages-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Status</th>
                  <th>Depth</th>
                  <th>Load</th>
                  <th>Words</th>
                  <th>Links in</th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {r.pages.map((p) => (
                  <tr key={p.url}>
                    <td className="pg">
                      <a href={p.url} target="_blank" rel="noopener noreferrer">
                        {pathOf(p.url)}
                      </a>
                      {p.title && <span>{p.title}</span>}
                    </td>
                    <td>
                      <span className={`st ${p.status >= 400 || p.status === 0 ? "bad" : p.status >= 300 ? "warn" : "ok"}`}>{p.status || "—"}</span>
                    </td>
                    <td>{p.depth ?? "sitemap"}</td>
                    <td>{p.ms ? `${(p.ms / 1000).toFixed(1)}s` : "—"}</td>
                    <td>{p.words || "—"}</td>
                    <td>{p.inlinks}</td>
                    <td>
                      {p.errors > 0 && <span className="pill error">{p.errors}</span>}
                      {p.warnings > 0 && <span className="pill warning">{p.warnings}</span>}
                      {!p.errors && !p.warnings && <span className="pill ok">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Gate / CTA ── */}
      {!unlocked ? (
        <LeadForm
          id="unlock"
          tool="site-audit"
          heading={`Unlock fixes for ${errWarnIssues} problem${errWarnIssues === 1 ? "" : "s"} on ${r.host}`}
          sub="Get every affected URL and step-by-step fixes for each issue. Free, no obligation."
          cta="Unlock the full audit"
          defaultWebsite={r.startUrl}
          onSuccess={unlock}
          details={{
            source: "Site Audit",
            audit_link: r.saved ? shareUrl : "not saved",
            site: r.host,
            site_health: `${r.health}%`,
            errors: r.counts.errors,
            warnings: r.counts.warnings,
            pages_crawled: r.pagesCrawled,
            top_issues: r.issues
              .slice(0, 6)
              .map((i) => `${i.title} (${i.count})`)
              .join("; "),
            mobile_speed: r.speed ? `${r.speed.performance}/100` : "n/a",
            google_business_profile: r.homepage?.gbp
              ? `${r.homepage.gbp.status}${r.homepage.gbp.reviews != null ? ` (${r.homepage.gbp.rating ?? "-"}★, ${r.homepage.gbp.reviews} reviews)` : ""}`
              : "not checked",
            competitor: r.competitor ? `${r.competitor.host} homepage score ${r.competitor.score} vs ours ${r.homepage?.score ?? "-"}` : "none",
          }}
        />
      ) : (
        <div className="card mt cta-card">
          {justUnlocked && (
            <div className="success" style={{ width: "100%" }}>
              <strong>Thanks! The full audit is unlocked.</strong> Open any issue to see the fix and every affected URL.
            </div>
          )}
          <div>
            <h2>Want us to fix these for you?</h2>
            <p className="lede" style={{ fontSize: 16 }}>
              Our team cleans up broken links, redirects, titles and speed issues every day. Book a free 20-minute call and
              we&apos;ll prioritize your list.
            </p>
          </div>
          <a className="btn" href={BOOKING_URL} target="_top">
            Book a free call
          </a>
        </div>
      )}
    </div>
  );
}

/* ───────────── Local & speed snapshot + head-to-head ───────────── */

const secs = (ms: number | null | undefined) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);
const hc = (r: HomepageReport, id: string) => r.checks.find((c) => c.id === id);

function Snapshot({ you, them, compError }: { you: HomepageReport; them: HomepageReport | null; compError: string }) {
  const sp = you.speed;
  const lcp = sp ? (sp.field?.lcpMs ?? sp.lcpMs) : null;
  const g = you.gbp;
  const phone = hc(you, "phone");
  const schema = hc(you, "schema");
  return (
    <div className="card mt">
      <h2>Local & speed snapshot</h2>
      <p className="note" style={{ marginTop: -4 }}>
        An in-depth look at your homepage: Google&apos;s own speed test and how you show up in local search.
      </p>
      <div className="snap">
        <div className="snap-box">
          <div className="snap-k">Google mobile speed</div>
          {sp ? (
            <>
              <div className="snap-v" style={{ color: sp.performance >= 90 ? "var(--good)" : sp.performance >= 50 ? "#b07a00" : "#d93636" }}>
                {sp.performance}
                <small>/100</small>
              </div>
              <div className="snap-sub">
                Main content in {secs(lcp)}
                {sp.field ? ` · real visitors: ${sp.field.category.toLowerCase()}` : ""}
              </div>
            </>
          ) : (
            <div className="snap-sub">{you.speedError || "Google's speed test was unavailable."}</div>
          )}
        </div>
        <div className="snap-box">
          <div className="snap-k">Google Business Profile</div>
          {g ? (
            g.status === "not_found" ? (
              <>
                <div className="snap-v bad">Not found</div>
                <div className="snap-sub">No listing linked to this website</div>
              </>
            ) : (
              <>
                <div className="snap-v">
                  {g.rating ? `★ ${g.rating.toFixed(1)}` : "No rating"}
                  <small> {g.reviews ?? 0} reviews</small>
                </div>
                <div className="snap-sub">
                  {g.mapsUri ? (
                    <a href={g.mapsUri} target="_blank" rel="noopener noreferrer">
                      {g.name}
                    </a>
                  ) : (
                    g.name
                  )}
                  {g.status === "possible" ? " · not linked to this site" : ""}
                </div>
              </>
            )
          ) : (
            <div className="snap-sub">Not checked</div>
          )}
        </div>
        <div className="snap-box">
          <div className="snap-k">Local basics</div>
          <ul className="snap-list">
            <li className={phone?.status ?? "warn"}>
              <span>{phone?.status === "pass" ? "✓" : phone?.status === "fail" ? "✕" : "!"}</span> Tap-to-call phone: {phone?.headline ?? "—"}
            </li>
            <li className={schema?.status ?? "warn"}>
              <span>{schema?.status === "pass" ? "✓" : schema?.status === "fail" ? "✕" : "!"}</span> Business schema: {schema?.headline ?? "—"}
            </li>
            <li className={you.url.startsWith("https:") ? "pass" : "fail"}>
              <span>{you.url.startsWith("https:") ? "✓" : "✕"}</span> Secure (HTTPS)
            </li>
          </ul>
        </div>
      </div>
      {them && <HeadToHead you={you} them={them} />}
      {compError && <p className="note">Competitor not checked: {compError}</p>}
    </div>
  );
}

function HeadToHead({ you, them }: { you: HomepageReport; them: HomepageReport }) {
  type Row = { label: string; a: string; b: string; win: "a" | "b" | "tie" };
  const num = (a: number | null | undefined, b: number | null | undefined, higher = true): "a" | "b" | "tie" =>
    a == null || b == null || a === b ? "tie" : (a > b) === higher ? "a" : "b";
  const lcpA = you.speed ? (you.speed.field?.lcpMs ?? you.speed.lcpMs) : null;
  const lcpB = them.speed ? (them.speed.field?.lcpMs ?? them.speed.lcpMs) : null;
  const statusRank = { pass: 2, warn: 1, fail: 0 } as const;
  const chk = (id: string, label: string): Row => {
    const a = hc(you, id);
    const b = hc(them, id);
    return { label, a: a?.headline ?? "—", b: b?.headline ?? "—", win: num(a ? statusRank[a.status] : null, b ? statusRank[b.status] : null) };
  };
  const rows: Row[] = [
    { label: "Homepage score", a: `${you.score} (${you.grade})`, b: `${them.score} (${them.grade})`, win: num(you.score, them.score) },
    { label: "Google mobile speed", a: you.speed ? `${you.speed.performance}/100` : "—", b: them.speed ? `${them.speed.performance}/100` : "—", win: num(you.speed?.performance, them.speed?.performance) },
    { label: "Main content load", a: secs(lcpA), b: secs(lcpB), win: num(lcpA, lcpB, false) },
    {
      label: "Google reviews",
      a: you.gbp && you.gbp.status !== "not_found" ? `${you.gbp.reviews ?? 0} (${you.gbp.rating?.toFixed(1) ?? "-"}★)` : you.gbp ? "No profile" : "—",
      b: them.gbp && them.gbp.status !== "not_found" ? `${them.gbp.reviews ?? 0} (${them.gbp.rating?.toFixed(1) ?? "-"}★)` : them.gbp ? "No profile" : "—",
      win: you.gbp && them.gbp ? num(you.gbp.status === "not_found" ? -1 : (you.gbp.reviews ?? 0), them.gbp.status === "not_found" ? -1 : (them.gbp.reviews ?? 0)) : "tie",
    },
    chk("title", "Page title"),
    chk("description", "Meta description"),
    chk("phone", "Tap-to-call phone"),
    chk("schema", "Business schema"),
    chk("https", "HTTPS"),
  ];
  const aWins = rows.filter((r) => r.win === "a").length;
  const bWins = rows.filter((r) => r.win === "b").length;
  return (
    <div className="h2h">
      <h3>
        Head-to-head vs {them.host}
      </h3>
      <p className="verdict" style={{ textAlign: "left" }}>
        {(() => {
          const ties = rows.length - aWins - bWins;
          const tally = `You lead on ${aWins}, ${them.host} leads on ${bWins}${ties ? `, ${ties} tied` : ""}.`;
          return aWins > bWins
            ? `You're ahead. ${tally} Here's how to widen the gap.`
            : aWins < bWins
              ? `${them.host} is ahead. ${tally} Here's where they're beating you.`
              : `Neck and neck. ${tally} Small fixes will decide who wins.`;
        })()}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="table h2h-table">
          <thead>
            <tr>
              <th></th>
              <th>You</th>
              <th>{them.host}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className={r.win === "a" ? "win" : r.win === "b" ? "lose" : ""}>{r.a}</td>
                <td className={r.win === "b" ? "win" : r.win === "a" ? "lose" : ""}>{r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
