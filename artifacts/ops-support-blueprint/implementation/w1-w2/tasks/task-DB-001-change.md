# DB-001 - 变更记录(D6)

## 基本信息
- Task ID: DB-001
- Owner: BE-2
- 日期: 2026-04-20
- 状态: Done

## 代码变更
- 新增迁移：
  - `db/migrations/001_project_issue_cluster/up.sql`
  - `db/migrations/001_project_issue_cluster/down.sql`
- 新增迁移执行器：
  - `scripts/db/migrate.js`
- 新增回归测试：
  - `test/db-migration.test.js`

## 影响范围
- 为 issue 与 cluster 业务域提供正式数据库结构基线。
- 为后续 API/Worker 切换到 DB 存储提供可执行入口。

## 回滚点
- 使用 `node scripts/db/migrate.js down --steps 1` 回滚 DB-001 变更。
