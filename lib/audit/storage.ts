import type { AuditReport, Comparison } from "./types";

/* Minimal D1 types (avoids depending on @cloudflare/workers-types) */
interface D1Stmt {
  bind(...v: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1 {
  prepare(sql: string): D1Stmt;
}

/**
 * Webflow Cloud exposes bindings through the OpenNext Cloudflare context
 * (the same object getCloudflareContext() returns). Reading it from the global
 * keeps this working without adding the adapter as a dependency, and returns
 * null when there's no database (e.g. plain `next dev`), so audits still run unsaved.
 */
export function getDb(): D1 | null {
  try {
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined>)[Symbol.for("__cloudflare-context__")];
    const db = ctx?.env?.DB as D1 | undefined;
    return db && typeof db.prepare === "function" ? db : null;
  } catch {
    return null;
  }
}

interface Row {
  id: string;
  created_at: string;
  health: number;
  errors: number;
  warnings: number;
  notices: number;
  issue_counts: string;
  report_json: string;
}

export async function previousAudit(host: string): Promise<Comparison | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const r = await db
      .prepare("SELECT id, created_at, health, errors, warnings, notices, issue_counts FROM site_audits WHERE host = ? ORDER BY created_at DESC LIMIT 1")
      .bind(host)
      .first<Row>();
    if (!r) return null;
    return {
      prevId: r.id,
      prevDate: r.created_at,
      prevHealth: r.health,
      prevCounts: { errors: r.errors, warnings: r.warnings, notices: r.notices },
      prevIssues: JSON.parse(r.issue_counts || "{}"),
    };
  } catch (err) {
    console.error("[audit] previousAudit failed", err);
    return null;
  }
}

export async function saveAudit(report: AuditReport): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const issueCounts = Object.fromEntries(report.issues.map((i) => [i.id, i.count]));
    await db
      .prepare(
        "INSERT INTO site_audits (id, host, start_url, created_at, pages_crawled, health, errors, warnings, notices, issue_counts, report_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        report.id,
        report.host,
        report.startUrl,
        report.createdAt,
        report.pagesCrawled,
        report.health,
        report.counts.errors,
        report.counts.warnings,
        report.counts.notices,
        JSON.stringify(issueCounts),
        JSON.stringify({ ...report, saved: true })
      )
      .run();
    return true;
  } catch (err) {
    console.error("[audit] saveAudit failed", err);
    return false;
  }
}

export async function loadAudit(id: string): Promise<AuditReport | null> {
  const db = getDb();
  if (!db || !/^[a-f0-9-]{36}$/.test(id)) return null;
  try {
    const r = await db.prepare("SELECT report_json FROM site_audits WHERE id = ?").bind(id).first<Row>();
    return r ? (JSON.parse(r.report_json) as AuditReport) : null;
  } catch (err) {
    console.error("[audit] loadAudit failed", err);
    return null;
  }
}
