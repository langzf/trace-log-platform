# API-001 - API变更说明(D3)

## 基本信息
- Task ID: API-001
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 变更摘要
新增 `POST /v1/events`，支持标准事件入站。

## 请求体
```json
{
  "projectKey": "order-service",
  "eventId": "evt_123",
  "sourceType": "feedback",
  "traceId": "tr_abc",
  "sessionId": "sess_1",
  "userId": "u_1",
  "payload": {
    "message": "checkout failed",
    "level": "warn",
    "service": "order-web"
  }
}
```

## 响应
- `202`
```json
{
  "ok": true,
  "issueId": "issue_xxx",
  "deduplicated": false
}
```
- `400`
```json
{
  "ok": false,
  "errorCode": "ERR-1001",
  "error": "payload field must be an object"
}
```

## 兼容性
- 不影响既有 `/v1/logs/frontend|backend|batch`。
- 新接口为增量能力。
