# API-001 - 变更记录(D6)

## 基本信息
- Task ID: API-001
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 代码变更
- `src/server.js`
  - 新增 `/v1/events` 路由
  - 新增入参校验、hash、错误封装
- `src/core/storage.js`
  - 新增 issue/event map 结构及写入方法
- `test/events-api.test.js`
  - 新增 API-001 覆盖用例

## 影响范围
- 仅新增能力，不影响原有日志接口。

## 回滚点
- 可移除 `/v1/events` 路由与相关存储字段扩展。
