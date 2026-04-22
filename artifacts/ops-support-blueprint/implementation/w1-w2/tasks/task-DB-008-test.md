# DB-008 - 测试说明(D4)

## 基本信息
- Task ID: DB-008
- Owner: BE-2
- 日期: 2026-04-21
- 状态: Done

## 覆盖用例
1. `db migrate up/down` 后 `model_policy` 表存在且可回滚
2. `POST /v1/config/model-policies` 支持创建与更新
3. `GET /v1/config/model-policies` 支持按项目查询
4. 非法 tier 参数返回 `400 ERR-1001`

## 测试实现
- `test/db-migration.test.js`
- `test/model-policy-api.test.js`
- 命令：`npm test -- --runInBand`
- 结果：通过

## 结论
DB-008 数据结构与 API 链路可用。
