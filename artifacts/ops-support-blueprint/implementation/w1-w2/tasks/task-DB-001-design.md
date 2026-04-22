# DB-001 - 任务设计(D1)

## 基本信息
- Task ID: DB-001
- Owner: BE-2
- 日期: 2026-04-20
- 状态: Done

## 关联
- 关联需求: REQ-001
- 关联表: `project`, `issue`, `cluster`

## 变更目标
在本地可执行数据库上落地核心实体表结构，确保 issue 主链路具备可迁移、可回滚的数据基础。

## 变更范围
- In scope:
  - 新增 `001_project_issue_cluster` 迁移（up/down）
  - 建立核心索引：`idx_issue_project_status`, `idx_issue_trace`, `idx_issue_priority_created`
  - 建立 `schema_migrations` 版本跟踪机制
- Out of scope:
  - 业务读写流量全部切换数据库
  - diagnosis/repair/release 后续表

## 风险与回退
- 风险：错误迁移顺序导致依赖表创建失败
- 回退方案：执行 `down` 逐步回滚并修复迁移脚本后重试
