# DB-008 - 数据变更说明(D2)

## 基本信息
- Task ID: DB-008
- Owner: BE-2
- 日期: 2026-04-21
- 状态: Done

## 变更摘要
新增数据库迁移 `005_model_policy`：
- 表：`model_policy`
- 关键字段：`project_id`, `policy_name`, `default_model_tier`, `upgrade_rules_json`, `budget_daily_tokens`, `budget_task_tokens`
- 约束：
  - `default_model_tier` 仅允许 `economy/performance/ultimate`
  - 唯一键 `(project_id, policy_name)`
  - `project_id` 外键关联 `project`

## DDL 位置
- `db/migrations/005_model_policy/up.sql`
- `db/migrations/005_model_policy/down.sql`

## 索引
- `idx_model_policy_project_policy`
- `idx_model_policy_tier`

## 回滚策略
- 通过 `node scripts/db/migrate.js down --steps 1` 回滚 DB-008。
