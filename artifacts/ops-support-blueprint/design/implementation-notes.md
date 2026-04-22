# Implementation Notes

## 1. 关键实现规则
1. 所有状态迁移必须经过状态机守卫。
2. 所有外部调用必须记录 requestId 与耗时。
3. 所有模型调用必须携带预算参数（max-turns/timeout/quota）。
4. 所有自动化动作必须可追溯到 taskId。

## 2. 建议技术栈
- API & Orchestration: Node.js / TypeScript
- Worker: Python + queue consumer
- DB: PostgreSQL
- Search: OpenSearch
- Queue: Kafka/RabbitMQ
- Metrics: Prometheus + Grafana

## 3. 可靠性
- 任务消费采用 at-least-once，业务层实现幂等。
- 核心写操作带乐观锁版本号。
- 控制面与执行面解耦，避免执行器抖动影响主流程。

## 4. 成本控制
- 默认 economy 模型，按条件升级。
- 执行器级并发上限可配置。
- 每日预算阈值与任务预算阈值双重控制。

## 5. 复盘机制
- 每个失败任务必须产出 retro。
- retro 聚合后由策略任务生成 skill 更新建议。
- 策略更新默认灰度生效，先小流量验证。
