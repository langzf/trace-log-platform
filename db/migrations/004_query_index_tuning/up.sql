CREATE INDEX IF NOT EXISTS idx_project_status_updated ON project(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_source_status_created ON issue(source_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executor_kind_enabled_priority ON executor_profile(kind, enabled, priority);
CREATE INDEX IF NOT EXISTS idx_audit_operator_time ON audit_log(operator_type, operator_id, created_at DESC);
