# 运维支撑体系蓝图设计包

本文档集面向内部部署的 7x24 自动化运维与缺陷修复体系，目标是形成从反馈/日志接入到修复发布与持续进化的完整闭环。

## 设计范围
- 面向内部研发与运维团队，不提供公网 SaaS 服务。
- 以闭环能力为主线，不以现有单一项目边界作为蓝图约束。
- 采用“垂类模型主跑 + 通用模型兜底”的模型分层策略。

## 文档目录

### 1) 需求包（Requirement Analysis）
- `requirements/requirement-baseline.md`
- `requirements/requirements-catalog.md`
- `requirements/acceptance-criteria.md`
- `requirements/open-issues.md`
- `requirements/signoff.md`

### 2) 产品包（PRD Design）
- `prd/prd-v1.md`
- `prd/user-stories.md`
- `prd/decision-log.md`
- `prd/requirement-mapping.md`
- `prd/prd-signoff.md`

### 3) 架构包（System Architecture Design）
- `architecture/hld.md`
- `architecture/context-diagram.md`
- `architecture/adr-log.md`
- `architecture/architecture-mapping.md`
- `architecture/architecture-signoff.md`

### 4) 数据模型包（Data Model Design）
- `data-model/er-model.md`
- `data-model/schema-design.md`
- `data-model/migration-plan.md`
- `data-model/data-model-mapping.md`
- `data-model/data-model-signoff.md`

### 5) API 包（API Design）
- `api/openapi.yaml`
- `api/error-code-spec.md`
- `api/versioning-policy.md`
- `api/api-mapping.md`
- `api/api-signoff.md`

### 6) 详细设计包（Detailed Design）
- `design/lld.md`
- `design/sequence-flows.md`
- `design/implementation-notes.md`
- `design/design-mapping.md`
- `design/design-signoff.md`
- `design/state-machine-spec.md`
- `design/retry-idempotency-spec.md`

### 7) 运维运行包（Operations）
- `operations/slo-sli-error-budget.md`
- `operations/capacity-scaling-plan.md`
- `operations/dr-and-backup-plan.md`
- `operations/observability-spec.md`
- `operations/oncall-incident-playbook.md`

### 8) 质量保障包（QA）
- `qa/qa-strategy.md`

### 9) 治理与实施包（Governance）
- `governance/change-management.md`
- `governance/raci.md`
- `governance/implementation-wbs-12w.md`
- `governance/development-task-breakdown-12w.md`
- `governance/task-register.md`
- `governance/release-readiness-gates.md`
- `governance/w1-w2-execution-plan.md`
- `governance/step-documentation-matrix.md`
- `governance/documentation-gate-checklist.md`

### 10) 异步契约包
- `api/async-event-contracts.md`

### 11) W1-W2 实施跟踪包
- `implementation/w1-w2/task-board.md`
- `implementation/w1-w2/change-log.md`
- `implementation/w1-w2/templates/task-design-template.md`
- `implementation/w1-w2/templates/task-test-template.md`
- `implementation/w1-w2/templates/task-runbook-template.md`
- `implementation/w1-w2/tasks/docs-manifest-w1-w2.md`
- `implementation/w1-w2/tasks/task-<TaskID>-*.md`（W1-W2 任务文档骨架）

## 统一标识规范
- 需求：`REQ-xxx`
- 用户故事：`US-xxx`
- 架构决策：`ADR-xxx`
- 错误码：`ERR-xxxx`

## 使用顺序
1. 先确认 `requirements` 与 `prd`。
2. 再冻结 `architecture`、`data-model`、`api`。
3. 最后依据 `design` 进入开发实施。
