# API-013 - API变更说明(D3)

## 基本信息
- Task ID: API-013
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 变更摘要
新增项目配置读写接口：
- `GET /v1/config/projects`
- `POST /v1/config/projects`

## GET 查询参数
- `status` (可选): 项目状态（如 `active/paused`）
- `limit` (可选): 默认 `200`

## POST 请求体
```json
{
  "projectKey": "order-service",
  "repoUrl": "git@github.com:acme/order-service.git",
  "defaultBranch": "main",
  "status": "active"
}
```

## 响应示例
- `GET /v1/config/projects`
```json
{
  "ok": true,
  "count": 1,
  "projects": [
    {
      "projectKey": "order-service",
      "repoUrl": "git@github.com:acme/order-service.git",
      "defaultBranch": "main",
      "status": "active"
    }
  ]
}
```

- `POST /v1/config/projects`
```json
{
  "ok": true,
  "project": {
    "projectKey": "order-service",
    "repoUrl": "git@github.com:acme/order-service.git",
    "defaultBranch": "main",
    "status": "active"
  }
}
```

## 错误码
- `ERR-1001`: 参数校验失败（如 `projectKey/repoUrl` 缺失）
