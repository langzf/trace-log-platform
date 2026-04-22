# DB-002 - 变更记录(D6)

## 基本信息
- Task ID: DB-002
- Owner: BE-2
- 日期: 2026-04-20
- 状态: Done

## 代码变更
- 新增迁移：
  - `db/migrations/003_audit_log/up.sql`
  - `db/migrations/003_audit_log/down.sql`
- 服务端：
  - `src/server.js` 新增审计写入点和 `GET /v1/audit-logs`
  - 新增可选 sqlite 审计落盘开关 `ENABLE_SQLITE_AUDIT`
- 存储层：
  - `src/core/storage.js` 新增 `auditLogs`、`addAuditLog/listAuditLogs`
  - `src/core/sqlite-audit-sink.js` 新增 sqlite 审计写入实现
- 测试：
  - `test/audit-api.test.js`
  - `test/db-migration.test.js`

## 影响范围
- 审计链路覆盖事件接入、配置变更、系统重置等关键动作。
- 为后续合规审计、执行器回放、问题追踪提供标准数据基础。

## 回滚点
- 关闭 `ENABLE_SQLITE_AUDIT`，并回滚 `003_audit_log` 迁移。
