# API-003 - 变更记录(D6)

## 基本信息
- Task ID: API-003
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 代码变更
- `src/server.js`
  - 新增 `GET /v1/issues` 路由
  - 修复 query 缺省场景 `limit` 默认值解析（`null` 不再转为 `0`）
- `test/events-api.test.js`
  - 新增/更新 issue 列表查询断言

## 影响范围
- issue 列表能力可被控制台与自动化流程直接消费。
- 修复后不传 `limit` 参数时可正常返回默认条数。

## 回滚点
- 可回滚 `GET /v1/issues` 路由与 `asInt` 逻辑到历史版本。
