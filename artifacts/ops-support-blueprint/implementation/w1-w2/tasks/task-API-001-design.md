# API-001 - 任务设计(D1)

## 基本信息
- Task ID: API-001
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 关联
- 关联需求: REQ-001
- 关联接口: `POST /v1/events`

## 变更目标
实现统一事件入站接口，接收标准化事件并返回 `202 Accepted` 与可追踪 `issueId`。

## 变更范围
- In scope:
  - 新增 `/v1/events` 路由
  - 入参校验（projectKey/eventId/sourceType/payload）
  - 事件入库并生成 issue 记录
  - 写入可观测日志（入站事件日志）
- Out of scope:
  - 分类/聚类/优先级 worker
  - issue 列表查询接口

## 数据影响
- 新增状态字段：`issues`, `eventIssueMap`, `idempotencyMap`, `stats.totalEvents`
- 兼容旧数据文件，初始化时自动补默认字段

## 风险与回退
- 风险：事件 payload 格式不稳定导致校验失败
- 回退方案：下线 `/v1/events` 路由并回退到 `/v1/logs/*` 入站
