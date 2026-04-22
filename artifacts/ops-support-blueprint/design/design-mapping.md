# Requirement to Detailed Design Mapping

| REQ ID | 设计模块 | 关键测试点 |
|---|---|---|
| REQ-001 | sdk-adapter, event-normalizer | SDK 上报兼容性测试 |
| REQ-002 | context-fetcher | trace 关联完整性测试 |
| REQ-003 | idempotency-guard | 重复事件防重测试 |
| REQ-004 | classifier-worker | 分类准确率回归测试 |
| REQ-005 | cluster-worker | 聚类命中率与阈值测试 |
| REQ-006 | priority-scorer | 优先级分布正确性测试 |
| REQ-007 | diagnosis-runner, evidence-builder | 证据链完整性测试 |
| REQ-008 | model-router | 路由策略命中与升级测试 |
| REQ-009 | task-orchestrator | 状态迁移与恢复测试 |
| REQ-010 | executor-selector, sandbox-runner | 并发隔离测试 |
| REQ-011 | sandbox-runner, result-callback | PR 自动创建测试 |
| REQ-012 | gate-runner | 门禁阻断测试 |
| REQ-013 | release-controller, rollback-controller | 灰度异常回滚测试 |
| REQ-014 | approval-gateway | 人工审批强制路径测试 |
| REQ-015 | metrics-collector | 指标正确性测试 |
| REQ-016 | audit-writer | 审计完整性测试 |
| REQ-017 | retro-aggregator | 复盘生成质量测试 |
| REQ-018 | budget-guard | 超预算熔断测试 |
| REQ-019 | retro-aggregator + alert adapter | 升级通知测试 |
| REQ-020 | Config Registry adapters | 配置变更生效测试 |
