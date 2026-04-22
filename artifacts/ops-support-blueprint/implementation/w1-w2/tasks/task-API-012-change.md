# API-012 - 变更记录(D6)

## 基本信息
- Task ID: API-012
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 代码变更
- `src/core/storage.js`
  - 新增 `executors` 状态字段
  - 新增 `listExecutors/upsertExecutor` 方法
- `src/server.js`
  - 新增 `GET/POST /v1/config/executors`
  - 新增执行器参数校验与布尔过滤解析
- `test/config-api.test.js`
  - 新增执行器配置创建、更新、查询、过滤、异常用例

## 影响范围
- 为执行器调度提供统一配置来源，支持多执行器节点接入。

## 回滚点
- 回滚 `executors` 存储字段和 `/v1/config/executors` 路由。
