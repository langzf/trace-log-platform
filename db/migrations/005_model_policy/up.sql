PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS model_policy (
  policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  policy_name TEXT NOT NULL DEFAULT 'default',
  default_model_tier TEXT NOT NULL CHECK (default_model_tier IN ('economy', 'performance', 'ultimate')),
  upgrade_rules_json TEXT NOT NULL DEFAULT '{}',
  budget_daily_tokens INTEGER NOT NULL DEFAULT 0,
  budget_task_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE,
  UNIQUE(project_id, policy_name)
);

CREATE INDEX IF NOT EXISTS idx_model_policy_project_policy ON model_policy(project_id, policy_name);
CREATE INDEX IF NOT EXISTS idx_model_policy_tier ON model_policy(default_model_tier);
