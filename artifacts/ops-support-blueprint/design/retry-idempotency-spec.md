# 重试与幂等规范

## 1. 幂等键
- 事件入站：`eventId`
- 任务创建：`issueId + phase`
- 回调处理：`taskId + callbackSeq`

## 2. 幂等窗口
- 默认 24h
- 高风险任务可配置 72h

## 3. 重试策略
- 外部 HTTP：指数退避 + 抖动
  - delay: 1s, 2s, 4s
  - max attempts: 3
- 队列消费失败：
  - 第 1-3 次快速重试
  - 第 4 次入 DLQ

## 4. 去重冲突
- 相同幂等键但请求体哈希不一致 -> `ERR-1002`

## 5. 可观测
- 记录 retryCount、firstAttemptAt、lastAttemptAt
- 统计重复请求命中率与冲突率
