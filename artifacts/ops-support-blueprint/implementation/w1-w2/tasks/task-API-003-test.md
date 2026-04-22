# API-003 - 测试说明(D4)

## 基本信息
- Task ID: API-003
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 覆盖用例
1. 事件入站后，`GET /v1/issues` 能返回对应 issue
2. 列表结果包含新增 issueId，且 `count >= 1`
3. 缺省 `limit` 时返回非空（验证默认值逻辑）

## 结果
- 执行命令：`npm test -- --runInBand`
- 结果：通过（含 `test/events-api.test.js` 列表查询断言）
