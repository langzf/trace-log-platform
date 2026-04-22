# Requirement to Data Model Mapping

| REQ ID | 数据实体 | 关键字段 |
|---|---|---|
| REQ-001 | project, issue | project_key, source_type, event_id |
| REQ-002 | issue, diagnosis_evidence | trace_id, session_id, pointer |
| REQ-003 | issue | event_id(unique) |
| REQ-004 | issue | category, subcategory |
| REQ-005 | cluster, issue | cluster_key, active_score |
| REQ-006 | issue | priority, sla_level |
| REQ-007 | diagnosis, diagnosis_evidence | root_cause_summary, confidence |
| REQ-008 | repair_task | model_tier, budget_tokens |
| REQ-009 | repair_task | state, updated_at |
| REQ-010 | repair_task | executor_key |
| REQ-011 | patch_pr | repo_branch, pr_url |
| REQ-012 | quality_gate_result | lint_passed, test_passed, scan_passed |
| REQ-013 | release_record | release_status, rollback_status |
| REQ-014 | repair_task, audit_log | risk_level, operator_type |
| REQ-015 | issue, repair_task, release_record | created_at, status |
| REQ-016 | audit_log | action, metadata_json |
| REQ-017 | task_retro | lessons_learned |
| REQ-018 | repair_task | max_turns, timeout_sec, tokens_used |
| REQ-019 | audit_log, repair_task | action, state |
| REQ-020 | project, executor_profile(配置中心) | project_key, executor_key |
