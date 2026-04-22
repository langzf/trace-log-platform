# SLO/SLI/Error Budget 规范

## 1. 服务分级
- P0链路：事件接入、任务编排、执行回调、门禁决策。
- P1链路：问题聚类、根因分析、审计查询。
- P2链路：报表、复盘聚合、历史分析。

## 2. SLI 定义
1. `ingest_success_rate`：`POST /v1/events` 成功写入并返回202比例。
2. `task_state_freshness`：任务状态更新时间滞后（秒）。
3. `diagnosis_latency_p95`：诊断完成 p95 耗时（分钟）。
4. `auto_pr_cycle_time_p95`：从 issue 到 PR 创建 p95 耗时（分钟）。
5. `gate_pass_rate`：门禁通过率。
6. `rollback_rate`：发布后回滚比例。
7. `cost_per_issue`：单 issue 平均成本。

## 3. SLO 目标
- P0 可用性：99.90%（月）
- 事件接入成功率：>= 99.95%
- 状态新鲜度：p95 <= 10s
- 高优诊断耗时：p95 <= 5min
- 自动PR周期：p95 <= 20min
- 成本偏差：日预算偏差 <= 10%

## 4. Error Budget
- 月 error budget：43.2 分钟（按 99.9%）
- 消耗策略：
  1) 消耗 > 30%：冻结非必要发布
  2) 消耗 > 60%：仅保留缺陷修复发布
  3) 消耗 > 90%：进入稳定性战时模式

## 5. 观测口径
- 统一使用 UTC 时间戳和 requestId/taskId 关联。
- 指标分项目、分环境（dev/staging/prod）看板。
- 成本指标区分模型层、执行层、人工层。

## 6. 报警阈值
- 接入成功率 5 分钟窗口 < 99.5%
- 任务积压队列长度 > 1000
- 诊断 p95 > 8 分钟持续 15 分钟
- 单日预算消耗 > 85%
