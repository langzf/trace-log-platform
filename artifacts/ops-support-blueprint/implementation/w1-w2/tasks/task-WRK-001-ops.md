# WRK-001 - 运维说明(D5)

## 基本信息
- Task ID: WRK-001
- Owner: AI-1
- 日期: 2026-04-21
- 状态: Done

## 运行与排障
- 队列主题状态：`GET /v1/system/queue/topics`
- 手工发消息：`POST /v1/system/queue/publish`
- 手工消费一条：`POST /v1/system/queue/process-next`
- 查看 DLQ：`GET /v1/system/queue/dlq?topic=<topic>`

## 关键指标
- `depth`: 当前主题积压
- `dlqDepth`: 死信积压
- `QUEUE_MAX_ATTEMPTS`: 入 DLQ 前最大尝试次数（默认 3）

## 告警建议
- `dlqDepth > 0` 持续 5 分钟告警
- 单主题 `depth > 300` 持续 5 分钟告警

## 回滚与应急
- 可通过 `POST /v1/system/reset` 清空队列与 DLQ
- 异常时切回同步处理路径，暂停 worker 消费
