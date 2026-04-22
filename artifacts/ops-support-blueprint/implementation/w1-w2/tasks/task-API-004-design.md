# API-004 - 任务设计(D1)

## 基本信息
- Task ID: API-004
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 关联
- 关联需求: REQ-003
- 关联接口: `GET /v1/issues/{issueId}`

## 变更目标
实现 issue 详情查询接口，返回 issue 基本信息与 timeline（日志时间线），供诊断与修复流程直接读取证据上下文。

## 变更范围
- In scope:
  - 新增 `GET /v1/issues/{issueId}`
  - issue 不存在返回 `404 ERR-1003`
  - issue 存在 traceId 时回填时间线日志
- Out of scope:
  - 详情接口权限隔离
  - 深度证据聚合（代码上下文、版本差异）

## 风险与回退
- 风险：traceId 缺失时 timeline 为空，需要上游补齐 trace 关联
- 回退方案：保留 issue 主数据返回，降级关闭 timeline 拼接
