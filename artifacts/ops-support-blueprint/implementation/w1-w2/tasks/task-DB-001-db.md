# DB-001 - 数据变更说明(D2)

## 基本信息
- Task ID: DB-001
- Owner: BE-2
- 日期: 2026-04-20
- 状态: Done

## 变更摘要
新增数据库迁移 `001_project_issue_cluster`：
- `project`：项目主数据
- `issue`：事件问题主表（含 `event_id` 唯一约束）
- `cluster`：问题聚类表
- 关键索引与外键约束完整落地

## DDL 位置
- `db/migrations/001_project_issue_cluster/up.sql`
- `db/migrations/001_project_issue_cluster/down.sql`

## 约束与索引
- 唯一约束：`project.project_key`, `issue.event_id`, `cluster.cluster_key`
- 外键：`issue.project_id -> project.project_id`, `cluster.project_id -> project.project_id`
- 索引：
  - `idx_issue_project_status`
  - `idx_issue_trace`
  - `idx_issue_priority_created`
  - `idx_cluster_project_last_seen`

## 回滚策略
- 通过 `node scripts/db/migrate.js down --steps 1` 执行该批次回滚。
