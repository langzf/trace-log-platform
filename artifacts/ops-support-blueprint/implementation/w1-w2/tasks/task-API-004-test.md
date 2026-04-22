# API-004 - 测试说明(D4)

## 基本信息
- Task ID: API-004
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 覆盖用例
1. `GET /v1/issues/{issueId}` 返回目标 issue 主数据
2. issue 关联 traceId 时，`timeline` 为数组且包含链路日志
3. issue 不存在时返回 `404 ERR-1003`

## 结果
- 执行命令：`npm test -- --runInBand`
- 结果：通过（含 issue 详情接口断言）
