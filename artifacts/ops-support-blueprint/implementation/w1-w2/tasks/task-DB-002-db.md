# DB-002 - 数据变更说明(D2)

## 基本信息
- Task ID: DB-002
- Owner: BE-2
- 日期: 2026-04-20
- 状态: Done

## 变更摘要
新增数据库迁移 `003_audit_log`：
- 审计主表：`audit_log`
- 索引：`idx_audit_entity_time`, `idx_audit_action_time`
- 约束：`operator_type` 限定 `agent/human/system`

## DDL 位置
- `db/migrations/003_audit_log/up.sql`
- `db/migrations/003_audit_log/down.sql`

## 应用写入契约
- 字段映射：
  - `audit_id` <- 审计事件ID
  - `entity_type/entity_id/action` <- 业务实体与动作
  - `operator_type/operator_id` <- 操作者信息
  - `metadata_json` <- 扩展上下文

## 查询能力
- 新增 API：`GET /v1/audit-logs`（支持按实体、动作、操作者过滤）

## 回滚策略
- 通过 `node scripts/db/migrate.js down --steps 1` 回滚 `audit_log` 迁移。
