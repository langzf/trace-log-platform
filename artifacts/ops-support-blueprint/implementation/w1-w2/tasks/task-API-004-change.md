# API-004 - 变更记录(D6)

## 基本信息
- Task ID: API-004
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 代码变更
- `src/server.js`
  - 新增 `GET /v1/issues/{issueId}` 路由
  - 增加 issue 不存在时 `ERR-1003` 语义化错误码
  - 根据 issue.traceId 组装 timeline 日志
- `src/core/storage.js`
  - 新增 `getIssueById` 查询方法
- `test/events-api.test.js`
  - 新增 issue 详情接口断言与 timeline 校验

## 影响范围
- 自动修复系统可直接按 issueId 拉取上下文日志，减少二次查询开销。

## 回滚点
- 可移除详情路由并回退为仅列表查询能力。
