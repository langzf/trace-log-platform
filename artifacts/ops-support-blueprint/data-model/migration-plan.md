# Migration Plan

## 阶段 1：基础模型上线（Week 1-2）
- 建立 `project`, `issue`, `cluster`, `audit_log`。
- 接入层完成标准事件入库与幂等。

## 阶段 2：诊断与修复模型（Week 3-6）
- 建立 `diagnosis`, `diagnosis_evidence`, `repair_task`, `patch_pr`。
- 支持从 issue 到 PR 的主链路流转。

## 阶段 3：门禁发布与进化（Week 7-10）
- 建立 `quality_gate_result`, `release_record`, `task_retro`。
- 完成门禁与复盘闭环。

## 阶段 4：优化与扩展（Week 11+）
- 增加冷热分层存储。
- 增加高频查询物化视图。
- 分库分表策略预案。

## 回滚策略
- 每次迁移脚本必须具备 down 方案。
- 结构变更前对核心表做快照备份。
- 避免一次迁移跨多个高风险对象。
