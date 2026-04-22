# 任务注册表（可直接分派）

## A. API 与接入任务

| Task ID | 周期 | 模块 | 任务 | 依赖 | 估算(人天) | DoD |
|---|---|---|---|---|---:|---|
| API-001 | W1 | ingest-api | 实现 `POST /v1/events` 入站与参数校验 | 无 | 3 | 202返回+错误码一致 |
| API-002 | W1 | ingest-api | 实现 Idempotency-Key 处理 | API-001 | 2 | 重复请求仅一次入库 |
| API-003 | W2 | issues-api | 实现 `GET /v1/issues` 列表查询 | DB-001 | 2 | 分页/过滤生效 |
| API-004 | W2 | issues-api | 实现 `GET /v1/issues/{issueId}` | DB-001 | 2 | issue+timeline 返回 |
| API-005 | W5 | diagnosis-api | 实现 `POST /v1/issues/{issueId}/diagnose` | WRK-006 | 2 | 可触发异步诊断 |
| API-006 | W5 | diagnosis-api | 实现 `GET /v1/diagnoses/{diagnosisId}` | DB-004 | 1.5 | 返回证据链 |
| API-007 | W7 | repair-api | 实现 `POST /v1/repair-tasks` | FSM-001 | 2 | task 创建并入队 |
| API-008 | W7 | repair-api | 实现 `GET /v1/repair-tasks/{taskId}` | DB-005 | 1.5 | 状态一致性正确 |
| API-009 | W7 | repair-api | 实现 `POST /v1/repair-tasks/{taskId}/dispatch` | EXE-002 | 2 | 路由并发起执行 |
| API-010 | W8 | patch-api | 实现 `GET /v1/patch-prs/{patchId}` | DB-006 | 1 | 含 gateStatus |
| API-011 | W9 | release-api | 实现 `POST /v1/releases/{releaseId}/rollback` | REL-003 | 2 | 自动回滚触发 |
| API-012 | W2 | config-api | 实现 `GET/POST /v1/config/executors` | DB-007 | 2 | 配置可读写 |
| API-013 | W2 | config-api | 实现 `GET/POST /v1/config/projects` | DB-007 | 2 | 项目配置生效 |
| API-014 | W3 | config-api | 实现 `GET/POST /v1/config/model-policies` | DB-008 | 2 | 路由策略可配置 |
| API-015 | W10 | metrics-api | 实现 `GET /v1/metrics/overview` | OBS-002 | 1.5 | 指标可读 |

## B. 数据库与迁移任务

| Task ID | 周期 | 模块 | 任务 | 依赖 | 估算(人天) | DoD |
|---|---|---|---|---|---:|---|
| DB-001 | W1 | schema | 建立 `project/issue/cluster` 表 | 无 | 3 | migration up/down 可执行 |
| DB-002 | W1 | schema | 建立 `audit_log` 表与写入 SDK | DB-001 | 2 | 审计查询可验证 |
| DB-003 | W3 | schema | 建立 `repair_task/patch_pr` 表 | DB-001 | 2.5 | 状态字段与索引完整 |
| DB-004 | W5 | schema | 建立 `diagnosis/diagnosis_evidence` | DB-001 | 2.5 | 证据链可关联 |
| DB-005 | W7 | schema | 建立 `quality_gate_result/release_record` | DB-003 | 2 | 门禁发布链路可落库 |
| DB-006 | W8 | schema | 建立 `task_retro` 表 | DB-003 | 1 | retro 可写入 |
| DB-007 | W1 | schema | 建立 `executor_profile` 表 | 无 | 1 | 配置API可读写 |
| DB-008 | W2 | schema | 建立 `model_policy` 表 | DB-007 | 1 | 路由策略可持久化 |
| DB-009 | W2 | index | 增加高频查询索引与 explain 校验 | DB-001 | 2 | 慢查降到基线 |
| DB-010 | W10 | retention | 实现审计与任务归档策略 | DB-002 | 2 | TTL/归档作业通过 |

## C. Worker 与异步任务

| Task ID | 周期 | 模块 | 任务 | 依赖 | 估算(人天) | DoD |
|---|---|---|---|---|---:|---|
| WRK-001 | W1 | queue | 建立 topic 与 DLQ | 无 | 1.5 | topic 可发布消费 |
| WRK-002 | W1 | queue | 实现统一 envelope + event version | WRK-001 | 1.5 | 消息契约测试通过 |
| WRK-003 | W2 | classifier | 分类 worker（建议/缺陷/子类） | WRK-001 | 3 | 分类结果落库 |
| WRK-004 | W3 | cluster | 聚类 worker（相似度+阈值） | WRK-003 | 3 | clusterId 稳定产出 |
| WRK-005 | W3 | priority | 优先级评分 worker | WRK-004 | 2 | P0-P3 与SLA生效 |
| WRK-006 | W5 | diagnosis | 诊断 worker（上下文抓取+模型调用） | WRK-005 | 4 | 输出confidence+evidence |
| WRK-007 | W7 | repair | 修复派发 worker | FSM-001 | 3 | 派发到执行器池 |
| WRK-008 | W8 | callback | 执行回调 worker | WRK-007 | 2 | 状态机推进正确 |
| WRK-009 | W11 | retro | retro 聚合 worker | DB-006 | 2 | 生成改进建议 |
| WRK-010 | W11 | budget | 成本熔断 worker | DB-008 | 2 | 超预算自动中断 |

## D. 控制面与状态机任务

| Task ID | 周期 | 模块 | 任务 | 依赖 | 估算(人天) | DoD |
|---|---|---|---|---|---:|---|
| FSM-001 | W6 | control-plane | 实现 RepairTask 状态机守卫 | DB-003 | 3 | 非法迁移返回ERR-1004 |
| FSM-002 | W6 | control-plane | 实现重试与退避策略 | FSM-001 | 2 | retryCount可观测 |
| FSM-003 | W6 | control-plane | 人工审批网关 | FSM-001 | 2 | 高风险强制人工 |
| RT-001 | W6 | routing | 模型路由策略引擎 | DB-008 | 3 | economy/perf/ultimate命中 |
| RT-002 | W7 | routing | 失败升级策略（模型/人工） | RT-001 | 2 | 升级链路可回放 |
| BG-001 | W6 | budget | 任务预算治理（max-turn/timeout） | RT-001 | 2 | 熔断策略有效 |

## E. 执行器与PR集成任务

| Task ID | 周期 | 模块 | 任务 | 依赖 | 估算(人天) | DoD |
|---|---|---|---|---|---:|---|
| EXE-001 | W7 | executor | 执行器发现与健康检查 | API-012 | 2 | 失效节点自动摘除 |
| EXE-002 | W7 | executor | 调度策略（优先级+RR） | EXE-001 | 2 | 分发可复现 |
| EXE-003 | W7 | executor | worktree 隔离执行实现 | EXE-002 | 3 | 同仓并发无冲突 |
| EXE-004 | W8 | executor | 标准回调契约实现 | EXE-003 | 2 | callback幂等 |
| EXE-005 | W8 | scm | PR 创建与变更摘要生成 | EXE-004 | 2 | PR URL可追踪 |

## F. 质量门禁与发布任务

| Task ID | 周期 | 模块 | 任务 | 依赖 | 估算(人天) | DoD |
|---|---|---|---|---|---:|---|
| QG-001 | W9 | gate | lint/test/scan 门禁编排 | API-010 | 3 | 门禁失败阻断 |
| QG-002 | W9 | gate | 关键回归用例最小集 | QG-001 | 2 | 用例稳定 |
| REL-001 | W9 | release | 灰度发布编排 | QG-001 | 2 | 支持10%灰度 |
| REL-002 | W10 | release | 线上指标阈值判定 | REL-001 | 1.5 | 自动判定健康 |
| REL-003 | W10 | release | 自动回滚实现 | REL-002 | 2 | 触发后回滚成功 |

## G. 运维、观测与治理任务

| Task ID | 周期 | 模块 | 任务 | 依赖 | 估算(人天) | DoD |
|---|---|---|---|---|---:|---|
| OBS-001 | W2 | observability | 指标埋点标准化 | API-001 | 2 | 指标统一标签 |
| OBS-002 | W3 | observability | 核心看板（MTTD/MTTR/成本） | OBS-001 | 2 | 看板可用 |
| OBS-003 | W4 | observability | 告警规则与升级通知 | OBS-002 | 2 | 阈值告警生效 |
| OPS-001 | W10 | operations | Oncall 与事故手册落地 | OBS-003 | 1.5 | 演练通过 |
| OPS-002 | W11 | operations | 容灾演练（RTO/RPO） | DB-010 | 2 | 演练报告完成 |
| GOV-001 | W1 | governance | 变更审批流与审计模板 | 无 | 1 | 模板启用 |
| GOV-002 | W11 | governance | 复盘机制与月度评审机制 | WRK-009 | 1.5 | 首次评审完成 |
