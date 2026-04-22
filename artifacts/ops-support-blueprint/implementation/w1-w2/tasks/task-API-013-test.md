# API-013 - 测试说明(D4)

## 基本信息
- Task ID: API-013
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 覆盖用例
1. `POST /v1/config/projects` 创建项目配置
2. 同 `projectKey` 二次 `POST` 执行 upsert 更新
3. `GET /v1/config/projects` 查询配置
4. `status` 过滤生效
5. 参数缺失返回 `400 ERR-1001`

## 结果
- 执行命令：`npm test -- --runInBand`
- 结果：通过（含 `test/config-api.test.js`）
