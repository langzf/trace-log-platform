# DB-009 - 数据变更说明(D2)

## 基本信息
- Task ID: DB-009
- Owner: BE-2
- 日期: 2026-04-20
- 状态: Done

## 变更摘要
新增 `004_query_index_tuning` 迁移，补全索引：
- `idx_project_status_updated`
- `idx_issue_source_status_created`
- `idx_executor_kind_enabled_priority`
- `idx_audit_operator_time`

## DDL 位置
- `db/migrations/004_query_index_tuning/up.sql`
- `db/migrations/004_query_index_tuning/down.sql`

## explain 校验覆盖查询
1. project 按 `status + updated_at` 列表
2. issue 按 `source_type + status + created_at` 列表
3. executor 按 `kind + enabled + priority` 列表
4. audit_log 按 `operator + created_at` 列表

## 回滚策略
- 执行 `node scripts/db/migrate.js down --steps 1` 回滚索引迁移。
