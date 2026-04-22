# API-013 - 变更记录(D6)

## 基本信息
- Task ID: API-013
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 代码变更
- `src/core/storage.js`
  - 新增 `projects` 状态字段
  - 新增 `listProjects/upsertProject` 方法
- `src/server.js`
  - 新增 `GET/POST /v1/config/projects`
  - 新增项目配置参数校验
- `test/config-api.test.js`
  - 新增项目配置创建、更新、查询、过滤、异常用例

## 影响范围
- 为自动修复任务提供项目仓库元数据来源，支撑跨项目拉仓执行。

## 回滚点
- 回滚 `projects` 字段与 `/v1/config/projects` 路由。
