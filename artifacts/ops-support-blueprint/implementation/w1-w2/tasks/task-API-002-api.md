# API-002 - API变更说明(D3)

## 基本信息
- Task ID: API-002
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 请求头
- `Idempotency-Key: <string>`（可选）

## 幂等行为
1. 首次请求：正常写入，`deduplicated=false`
2. 同键同体：`202`，`deduplicated=true`，`idempotencyReplayed=true`
3. 同键异体：`400`，`errorCode=ERR-1002`

## 错误响应示例
```json
{
  "ok": false,
  "errorCode": "ERR-1002",
  "error": "Idempotency key conflicts with different request payload",
  "issueId": "issue_xxx"
}
```
