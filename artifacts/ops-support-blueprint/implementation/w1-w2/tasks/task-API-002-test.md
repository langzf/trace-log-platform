# API-002 - 测试说明(D4)

## 基本信息
- Task ID: API-002
- 测试负责人: BE-1
- 测试日期: 2026-04-20
- 状态: Done

## 覆盖用例
1. 首次带幂等键请求返回 `202` 且 `deduplicated=false`
2. 同键同体重放返回 `202` 且 `idempotencyReplayed=true`
3. 同键异体返回 `400 ERR-1002`

## 结果
- 测试文件：`test/events-api.test.js`
- 执行结果：通过
