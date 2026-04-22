PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project (
  project_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL UNIQUE,
  repo_url TEXT,
  default_branch TEXT NOT NULL DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS issue (
  issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('feedback', 'log', 'alert')),
  event_id TEXT NOT NULL UNIQUE,
  trace_id TEXT,
  session_id TEXT,
  user_id TEXT,
  category TEXT NOT NULL DEFAULT 'untriaged',
  subcategory TEXT,
  priority TEXT NOT NULL DEFAULT 'P3',
  sla_level TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_issue_project_status ON issue(project_id, status);
CREATE INDEX IF NOT EXISTS idx_issue_trace ON issue(trace_id);
CREATE INDEX IF NOT EXISTS idx_issue_priority_created ON issue(priority, created_at);

CREATE TABLE IF NOT EXISTS cluster (
  cluster_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  cluster_key TEXT NOT NULL UNIQUE,
  title TEXT,
  similarity_threshold REAL NOT NULL DEFAULT 0.8,
  active_score REAL NOT NULL DEFAULT 0,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cluster_project_last_seen ON cluster(project_id, last_seen_at);
