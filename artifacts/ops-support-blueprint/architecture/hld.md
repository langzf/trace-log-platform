# High-Level Design (HLD)

## 1. 架构目标
构建内部运维智能闭环体系，覆盖“采集 -> 理解 -> 诊断 -> 修复 -> 验证 -> 发布 -> 进化”全流程，并满足高可用、可追溯、可扩展和成本可控要求。

## 2. 核心模块
1. **Trace Ingest Platform**
- SDK/协议接入
- 事件标准化
- 幂等去重与入队

2. **Issue Intelligence Service**
- 分类、聚类、优先级与 SLA 分层
- 问题池维护与趋势聚合

3. **Diagnosis Engine**
- 日志/Trace/代码上下文联合诊断
- 根因候选与证据链生成

4. **Repair Control Plane**
- RepairTask 状态机
- 模型路由与预算控制
- 人工审批与自动化分流

5. **Executor Runtime Pool**
- 多机执行器（OpenClaw/Codex/Claude）
- worktree 隔离与并发调度

6. **Quality Release Gate**
- 自动测试、静态扫描、灰度观测
- 回滚触发与发布记录

7. **Observability & Evolution Hub**
- 指标看板、审计查询
- task retro 聚合与策略优化建议

8. **Config Registry**
- 项目、仓库、执行器、模型策略统一管理

## 3. 关键架构原则
- **分层解耦**：能力边界清晰，模块可独立扩展。
- **异步优先**：主流程通过队列驱动，降低峰值冲击。
- **状态可追踪**：所有关键节点有显式状态与时间戳。
- **安全发布**：自动修复止于 PR，发布必须门禁。
- **成本优先治理**：任务级预算硬约束。

## 4. 运行拓扑
- 控制面：Issue Intelligence / Diagnosis / Repair Control Plane。
- 数据面：Ingest / Queue / Store / Index / Metrics。
- 执行面：Executor Runtime Pool（多机并行）。
- 守护面：Quality Gate / Rollback / Alert。

## 5. 非功能实现策略
- 可用性：核心服务双实例 + 健康检查 + 自动重试。
- 性能：高频路径缓存 + 批量聚类 + 并行执行。
- 一致性：幂等键（eventId/taskId）+ 状态机防重入。
- 可观测：指标、日志、审计统一采集。
- 成本：max-turns、timeout、quota、熔断。

## 6. 失败域与降级策略
- 分类/聚类失败：转入“待人工分诊”队列。
- 诊断失败：升级到高能力模型或人工接管。
- 修复失败：保留证据链并生成失败复盘记录。
- 门禁失败：阻断发布并通知责任人。

## 7. 生产级补充约束
- 详细 SLO/SLI/Error Budget 见 `operations/slo-sli-error-budget.md`。
- 容量与扩缩容规则见 `operations/capacity-scaling-plan.md`。
- 容灾、备份与演练见 `operations/dr-and-backup-plan.md`。
- 值班与事故响应见 `operations/oncall-incident-playbook.md`。
- 变更治理与审批见 `governance/change-management.md`。
