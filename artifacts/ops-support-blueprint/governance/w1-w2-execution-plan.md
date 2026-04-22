# W1-W2 开工执行计划（按角色分配）

## 1. 目标
在两周内交付“可运行最小闭环底座”：事件接入、幂等、核心数据表、基础查询、最小审计、基础观测。

## 2. 角色与责任
- TL（技术负责人）：节奏控制、设计评审、风险决策。
- BE-1：接入与 API 实现（API-001/002/003/004/012/013）。
- BE-2：数据库与迁移（DB-001/002/007/008/009）。
- AI-1：异步契约和分类 worker 基础（WRK-001/002/003）。
- SRE：环境、日志、指标、告警基线（OBS-001）。
- QA：测试设计与验收门禁（W1-W2 用例集）。

## 3. 周计划

### Week 1
1. Day 1
- 启动会：冻结 W1-W2 范围与责任人。
- TL 输出任务依赖图最终版。

2. Day 2-3
- BE-2 完成 `project/issue/cluster` 与 `executor_profile` 表（DB-001/007）。
- AI-1 完成 topic/DLQ 和消息 envelope 草案（WRK-001/002）。

3. Day 4
- BE-1 完成 `POST /v1/events` 参数校验与入站流程（API-001）。
- BE-1 实现幂等键逻辑（API-002）。

4. Day 5
- 联调：API 入站 -> DB 入库 -> Queue 投递。
- QA 完成 W1 回归用例执行。

### Week 2
1. Day 6-7
- BE-1 完成 `GET /v1/issues` 与 `GET /v1/issues/{issueId}`（API-003/004）。
- BE-2 完成 `audit_log`、`model_policy` 与索引优化（DB-002/008/009）。

2. Day 8
- BE-1 完成配置接口 `config/executors`、`config/projects`（API-012/013）。
- AI-1 完成分类 worker 最小实现（WRK-003）。

3. Day 9
- SRE 完成核心指标埋点标准（OBS-001）。
- QA 完成 W2 全链路验收。

4. Day 10
- TL 组织里程碑评审（Go/No-Go）。
- 输出 W3-W4 进入条件清单。

## 4. 进入 W3-W4 的硬门槛
1. `/v1/events` 在压测基线下接入成功率 >= 99.5%。
2. eventId 幂等行为稳定，冲突行为符合 ERR-1002。
3. `issue` 查询可用，分页和过滤正确。
4. topic、DLQ、审计日志均可追踪。
5. 文档产出满足 `documentation-gate-checklist.md`。

## 5. 风险与预案
- 风险1：幂等冲突逻辑复杂，影响接入稳定性。
  - 预案：先实现严格模式（同键同体），后续扩展兼容。
- 风险2：索引策略不当导致查询性能抖动。
  - 预案：W2 完成 explain 基线并固化索引。
- 风险3：队列与数据库一致性窗口。
  - 预案：引入 outbox 方案评估并在 W3 决策。
