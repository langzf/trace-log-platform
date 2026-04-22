# 12周可执行开发任务清单（接口/表/Worker级）

## 1. 目标
基于蓝图文档，将实现任务拆解为可直接分派的工程条目，覆盖 API、数据库、异步 Worker、控制面、执行面、门禁与运维。

## 2. 团队编制假设
- 后端工程师：3 人
- 平台/AI 工程师：2 人
- SRE：1 人
- QA：1 人
- 技术负责人：1 人（兼架构与评审）

## 3. 里程碑与周计划

### W1-W2 基础设施与接入底座
- 输出：统一事件模型、基础数据表、接入 API、幂等机制、最小审计。
- 关键验收：`POST /v1/events` 可稳定接入并幂等。

### W3-W4 问题理解层
- 输出：分类/聚类/优先级 worker 与问题池查询 API。
- 关键验收：`issue -> cluster -> priority` 自动流转。

### W5-W6 诊断层
- 输出：诊断任务编排、证据链生成、诊断报告接口。
- 关键验收：P1 问题 5 分钟内给出诊断结果。

### W7-W8 修复编排与执行层
- 输出：RepairTask 状态机、执行器调度、worktree 并发、PR 回调。
- 关键验收：从 issue 自动到 PR（非发布）。

### W9-W10 门禁与发布护栏
- 输出：质量门禁接口、灰度与回滚流程、发布记录。
- 关键验收：门禁失败可阻断，灰度异常可自动回滚。

### W11-W12 运维闭环与进化
- 输出：SLO看板、预算熔断、复盘聚合、告警升级、DR演练。
- 关键验收：端到端闭环稳定运行，达到上线评审门槛。

## 4. 工作流拆分

### Stream A：Ingest + API
- 负责人：Backend-1
- 范围：`/v1/events`, `/v1/issues*`, 配置 API，OpenAPI 对齐

### Stream B：Data + Queue + Worker
- 负责人：Backend-2
- 范围：核心表、索引、迁移、Topic、DLQ、消费幂等

### Stream C：Diagnosis + Repair Control
- 负责人：AI-1
- 范围：模型路由、状态机、预算治理、策略升级

### Stream D：Executor + PR Integration
- 负责人：AI-2
- 范围：执行器池、worktree、回调处理、PR 元数据

### Stream E：Quality Gate + Release + Ops
- 负责人：SRE + QA
- 范围：门禁、灰度回滚、观测、告警、值班、演练

## 5. 关键依赖图
1. DB schema 初始化 -> API 写入接口 -> 分类/聚类 worker
2. 诊断输出稳定 -> RepairTask 创建 -> 执行器调度
3. PR 回调稳定 -> 质量门禁 -> 发布控制
4. 状态机与审计打通 -> 看板与治理规则生效

## 6. 任务估算汇总（人天）
- Stream A：38 人天
- Stream B：34 人天
- Stream C：36 人天
- Stream D：30 人天
- Stream E：32 人天
- 合计：170 人天（不含缓冲）
- 风险缓冲：20%（34 人天）
- 总预算：204 人天

## 7. Definition of Done（统一）
1. 代码合并到主干并通过 CI。
2. OpenAPI/数据字典/时序文档同步更新。
3. 关键路径用例（成功/失败/重试）覆盖。
4. 审计字段完整（requestId/taskId/operator）。
5. 指标可观测（耗时、成功率、失败原因、成本）。
