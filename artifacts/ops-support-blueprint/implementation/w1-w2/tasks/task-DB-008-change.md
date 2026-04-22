# DB-008 - 变更记录(D6)

## 基本信息
- Task ID: DB-008
- Owner: BE-2
- 日期: 2026-04-21
- 状态: Done

## 代码变更
- 迁移：
  - `db/migrations/005_model_policy/up.sql`
  - `db/migrations/005_model_policy/down.sql`
- 存储与服务：
  - `src/core/storage.js` 新增 `modelPolicies` 与 upsert/list 方法
  - `src/server.js` 新增 `GET/POST /v1/config/model-policies`
- 测试：
  - `test/model-policy-api.test.js`
  - `test/db-migration.test.js`（迁移计数更新）

## 影响范围
- 为模型路由策略和预算治理提供配置数据基础。

## 回滚点
- 回滚 DB-008 迁移并撤销 model policy API。
