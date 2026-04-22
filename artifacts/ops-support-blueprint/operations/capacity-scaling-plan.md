# 容量与扩缩容规划

## 1. 负载模型
- 峰值事件速率：2,000 events/min
- 平均事件速率：400 events/min
- 高峰持续时长：30-90 分钟
- 并发修复任务峰值：80 tasks

## 2. 容量计算基线
- 接入层：单实例 300 req/s，至少 3 实例（N+1）
- intelligence worker：单 worker 20 jobs/min
- diagnosis worker：单 worker 6 jobs/min
- executor slot：单 executor 并发 2-6（由仓库大小决定）

## 3. 扩容策略
- 自动扩容触发：
  - queue lag > 300 持续 5min
  - diagnosis latency p95 > 6min 持续 10min
- 自动缩容触发：
  - queue lag < 30 持续 30min
  - CPU < 35% 持续 30min

## 4. 资源隔离
- 不同项目按 `projectKey` 配置并发配额。
- 高优任务保留独占 executor pool（最少 20% 容量）。

## 5. 反压与削峰
- 接入层超限返回 429 + Retry-After。
- 低优任务进入延迟队列（延迟 1-5 分钟）。
- 日预算触发时仅保留 P0/P1 流程。

## 6. 压测计划
- 场景A：突发 5 倍流量 30 分钟。
- 场景B：执行器失效 30% 节点。
- 场景C：模型服务高延迟（2x）。
- 验收：核心 SLO 不突破红线，积压可在 60 分钟内回落。
