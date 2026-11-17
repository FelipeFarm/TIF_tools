-- Saved Site Audit reports (one row per audit run)
CREATE TABLE IF NOT EXISTS site_audits (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  start_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  pages_crawled INTEGER NOT NULL,
  health INTEGER NOT NULL,
  errors INTEGER NOT NULL,
  warnings INTEGER NOT NULL,
  notices INTEGER NOT NULL,
  issue_counts TEXT NOT NULL,  -- JSON: { issueId: count }
  report_json TEXT NOT NULL     -- full AuditReport JSON
);
CREATE INDEX IF NOT EXISTS idx_site_audits_host ON site_audits (host, created_at);
