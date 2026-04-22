# 异步事件契约（Queue Topics）

## 1. Topic 列表
- `ops.issue.ingested.v1`
- `ops.issue.classified.v1`
- `ops.issue.clustered.v1`
- `ops.issue.diagnosed.v1`
- `ops.repair.task.created.v1`
- `ops.repair.task.state.changed.v1`
- `ops.patch.pr.created.v1`
- `ops.release.decision.v1`
- `ops.retro.generated.v1`

## 2. 通用 Envelope
```json
{
  "eventType": "ops.issue.ingested.v1",
  "eventId": "evt_xxx",
  "occurredAt": "2026-04-20T12:00:00Z",
  "traceId": "tr_xxx",
  "projectKey": "order-service",
  "payload": {}
}
```

## 3. 语义规则
- at-least-once 交付。
- 消费者必须幂等处理（eventId 去重）。
- 失败消息进入 DLQ：`ops.dlq.<topic>`。

## 4. 版本规则
- 兼容变更：字段新增可选。
- 破坏变更：新增 topic 后缀 `v2`。

## 5. 重放策略
- 支持按时间窗口重放。
- 重放任务必须带 `replayId` 并写审计日志。
