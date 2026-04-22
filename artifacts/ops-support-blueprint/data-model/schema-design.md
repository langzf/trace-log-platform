# Schema Design

## 存储策略
- 事务型数据：PostgreSQL。
- 大体量日志与检索：OpenSearch/Elastic。
- 原始制品（patch、retro 文件）：对象存储。

## 关键表（PostgreSQL）

### 1) project
- `project_id` PK
- `project_key` UNIQUE
- `repo_url`
- `default_branch`
- `status`
- `created_at`, `updated_at`

### 2) issue
- `issue_id` PK
- `project_id` FK
- `source_type` (feedback/log/alert)
- `event_id` UNIQUE
- `trace_id`, `session_id`, `user_id`
- `category`, `subcategory`
- `priority`, `sla_level`
- `status`
- `created_at`, `updated_at`

索引建议：
- `idx_issue_project_status (project_id, status)`
- `idx_issue_trace (trace_id)`
- `idx_issue_priority_created (priority, created_at)`

### 3) cluster
- `cluster_id` PK
- `project_id` FK
- `cluster_key` UNIQUE
- `title`
- `similarity_threshold`
- `active_score`
- `last_seen_at`

### 4) diagnosis
- `diagnosis_id` PK
- `issue_id` FK
- `root_cause_summary`
- `confidence` DECIMAL(5,4)
- `model_tier`
- `status`
- `created_at`

### 5) diagnosis_evidence
- `evidence_id` PK
- `diagnosis_id` FK
- `evidence_type` (log/trace/code/web)
- `pointer` (path/url/ref)
- `snippet_hash`
- `created_at`

### 6) repair_task
- `task_id` PK
- `issue_id` FK
- `diagnosis_id` FK NULL
- `state` (queued/running/review/passed/failed/canceled)
- `risk_level`
- `model_tier`
- `executor_key`
- `max_turns`, `timeout_sec`
- `budget_tokens`, `tokens_used`
- `created_at`, `updated_at`

索引建议：
- `idx_task_state_updated (state, updated_at)`
- `idx_task_executor_state (executor_key, state)`

### 7) patch_pr
- `patch_id` PK
- `task_id` FK
- `repo_branch`
- `pr_url`
- `pr_status`
- `changed_files`
- `created_at`

### 8) quality_gate_result
- `gate_id` PK
- `patch_id` FK
- `lint_passed`
- `test_passed`
- `scan_passed`
- `gate_status`
- `report_url`
- `created_at`

### 9) release_record
- `release_id` PK
- `patch_id` FK
- `environment`
- `release_status`
- `rollback_status`
- `metrics_snapshot`
- `created_at`

### 10) task_retro
- `retro_id` PK
- `task_id` FK
- `failure_pattern`
- `lessons_learned`
- `proposed_skill_updates`
- `created_at`

### 11) executor_profile
- `executor_key` PK
- `kind`
- `endpoint`
- `enabled`
- `priority`
- `region`
- `max_concurrent`
- `created_at`, `updated_at`

### 12) model_policy
- `policy_id` PK
- `project_id` FK
- `policy_name`
- `default_model_tier`
- `upgrade_rules_json`
- `budget_daily_tokens`
- `budget_task_tokens`
- `created_at`, `updated_at`

### 13) audit_log
- `audit_id` PK
- `entity_type`
- `entity_id`
- `action`
- `operator_type` (agent/human/system)
- `operator_id`
- `metadata_json`
- `created_at`

## 数据约束
- `event_id` 全局唯一，保证接入幂等。
- `task_id` 在状态迁移时采用乐观锁版本号控制。
- `confidence` 范围约束 `0 <= confidence <= 1`。
