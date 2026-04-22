# DB-002 - 测试说明(D4)

## 基本信息
- Task ID: DB-002
- Owner: BE-2
- 日期: 2026-04-20
- 状态: Done

## 覆盖用例
1. 迁移 `up/down` 后 `audit_log` 表生命周期正确
2. 关键动作（`config.project.upsert`, `issue.created`）可写入审计日志
3. 审计查询过滤参数生效（`entityType/entityId/operatorType`）
4. 启用 sqlite 审计落盘后，`audit_log` 表可查到记录

## 测试实现
- 文件：
  - `test/db-migration.test.js`
  - `test/audit-api.test.js`
- 命令：`npm test -- --runInBand`
- 结果：通过

## 结论
DB-002 迁移与应用写入/查询链路可用，满足审计可验证要求。
