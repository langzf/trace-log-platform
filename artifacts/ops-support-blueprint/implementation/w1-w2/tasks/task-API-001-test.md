# API-001 - 测试说明(D4)

## 基本信息
- Task ID: API-001
- 测试负责人: BE-1
- 测试日期: 2026-04-20
- 状态: Done

## 覆盖用例
1. 正常入站：`POST /v1/events` 返回 `202` + `issueId`
2. eventId 去重：同 eventId 二次提交返回 `deduplicated=true`
3. 参数校验：缺失 payload 返回 `400 ERR-1001`

## 结果
- 执行命令：`npm test`
- 结果：全部通过（含新增 `events-api.test.js`）
