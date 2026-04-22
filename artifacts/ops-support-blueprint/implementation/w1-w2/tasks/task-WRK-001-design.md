# WRK-001 - 任务设计(D1)

## 基本信息
- Task ID: WRK-001
- Owner: AI-1
- 日期: 2026-04-21
- 状态: Done

## 关联
- 关联需求: REQ-011
- 关联模块: queue runtime

## 变更目标
建立基础 topic + DLQ 机制，支持消息发布、消费失败重试、失败入 DLQ 的最小可靠链路。

## 变更范围
- In scope:
  - 新增内存队列模块 `InMemoryTopicQueue`
  - 支持 `publish/pull/nack/listTopics/peekDlq/reset`
  - 新增队列管理 API（publish/process-next/topics/dlq）
- Out of scope:
  - 外部 MQ（Kafka/RabbitMQ）接入
  - 分布式消费者与幂等存储

## 风险与回退
- 风险：内存队列重启后消息丢失
- 回退方案：仅保留同步处理逻辑，关闭 queue 管理入口
