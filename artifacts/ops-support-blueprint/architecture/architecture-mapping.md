# Requirement to Architecture Mapping

| REQ ID | 关键组件 | 说明 |
|---|---|---|
| REQ-001 | Trace Ingest Platform | SDK 接入与协议标准化 |
| REQ-002 | Trace Ingest Platform, Diagnosis Engine | 统一链路上下文与诊断引用 |
| REQ-003 | Trace Ingest Platform, Repair Control Plane | 幂等去重与状态防重入 |
| REQ-004 | Issue Intelligence Service | 分类能力 |
| REQ-005 | Issue Intelligence Service | 聚类能力与阈值管理 |
| REQ-006 | Issue Intelligence Service | 优先级评分与 SLA 路由 |
| REQ-007 | Diagnosis Engine | 根因候选与证据链 |
| REQ-008 | Repair Control Plane | 模型路由策略 |
| REQ-009 | Repair Control Plane | 任务状态机与重试 |
| REQ-010 | Executor Runtime Pool | 并发调度和隔离 |
| REQ-011 | Repair Control Plane, Executor Runtime Pool | 自动修复与 PR 创建 |
| REQ-012 | Quality Release Gate | 测试和扫描门禁 |
| REQ-013 | Quality Release Gate | 灰度观测与回滚 |
| REQ-014 | Repair Control Plane, Ops Console | 人工审批与接管 |
| REQ-015 | Observability Hub | 指标与看板 |
| REQ-016 | Observability Hub | 审计与追踪 |
| REQ-017 | Observability Hub | 复盘输出与优化建议 |
| REQ-018 | Repair Control Plane | 预算熔断 |
| REQ-019 | Observability Hub | 通知升级 |
| REQ-020 | Config Registry | 项目、执行器、策略管理 |
