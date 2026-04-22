# DB-007 - 数据变更说明(D2)

## 基本信息
- Task ID: DB-007
- Owner: BE-2
- 日期: 2026-04-20
- 状态: Done

## 变更摘要
新增数据库迁移 `002_executor_profile`：
- `executor_profile`：执行器注册信息表
- 含字段：`executor_key/kind/endpoint/enabled/priority/region/max_concurrent`
- 含索引：`idx_executor_enabled_priority`

## DDL 位置
- `db/migrations/002_executor_profile/up.sql`
- `db/migrations/002_executor_profile/down.sql`

## 数据约束
- `executor_key` 主键
- `enabled` 约束 `IN (0, 1)`
- `endpoint` 非空

## 回滚策略
- 通过 `node scripts/db/migrate.js down --steps 1` 回滚 DB-007。
