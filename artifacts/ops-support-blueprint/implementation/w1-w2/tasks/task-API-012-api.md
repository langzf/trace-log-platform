# API-012 - API变更说明(D3)

## 基本信息
- Task ID: API-012
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 变更摘要
新增执行器配置读写接口：
- `GET /v1/config/executors`
- `POST /v1/config/executors`

## GET 查询参数
- `enabled` (可选): `true|false`
- `kind` (可选): 执行器类型，如 `codex/openclaw/claude-code`
- `limit` (可选): 默认 `200`

## POST 请求体
```json
{
  "executorKey": "exec-codex-a",
  "kind": "codex",
  "endpoint": "http://10.0.0.11:18789/v1",
  "enabled": true,
  "priority": 10
}
```

## 响应示例
- `GET /v1/config/executors`
```json
{
  "ok": true,
  "count": 1,
  "executors": [
    {
      "executorKey": "exec-codex-a",
      "kind": "codex",
      "endpoint": "http://10.0.0.11:18789/v1",
      "enabled": true,
      "priority": 10
    }
  ]
}
```

- `POST /v1/config/executors`
```json
{
  "ok": true,
  "executor": {
    "executorKey": "exec-codex-a",
    "kind": "codex",
    "endpoint": "http://10.0.0.11:18789/v1",
    "enabled": true,
    "priority": 10
  }
}
```

## 错误码
- `ERR-1001`: 参数校验失败（如 `executorKey/endpoint` 缺失）
