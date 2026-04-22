# API-003 - API变更说明(D3)

## 基本信息
- Task ID: API-003
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 变更摘要
新增 `GET /v1/issues`，返回 issue 列表，支持过滤和数量限制。

## 请求参数
- `projectKey` (可选): 项目标识
- `status` (可选): issue 状态
- `sourceType` (可选): 来源类型 `feedback|log|alert`
- `limit` (可选): 返回条数上限，默认 `200`

## 响应
- `200`
```json
{
  "ok": true,
  "count": 2,
  "issues": [
    {
      "id": "issue_xxx",
      "projectKey": "order-service",
      "status": "new",
      "sourceType": "log"
    }
  ]
}
```

## 兼容性与注意事项
- 与既有日志接口无冲突，属于增量能力。
- 修复了 query 参数缺失时 `limit` 误解析为 `0` 的问题，确保默认返回数据。
