# API-004 - API变更说明(D3)

## 基本信息
- Task ID: API-004
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 变更摘要
新增 `GET /v1/issues/{issueId}`，返回 issue 详情与 timeline。

## 路径参数
- `issueId` (必填): issue 主键

## 响应
- `200`
```json
{
  "ok": true,
  "issue": {
    "id": "issue_xxx",
    "projectKey": "order-service",
    "traceId": "tr_xxx"
  },
  "timeline": [
    {
      "id": "log_xxx",
      "traceId": "tr_xxx",
      "message": "order api timeout"
    }
  ]
}
```

- `404`
```json
{
  "ok": false,
  "errorCode": "ERR-1003",
  "error": "Issue not found"
}
```

## 兼容性
- 新增接口，不影响既有 `/v1/bugs`、`/v1/traces/*`。
