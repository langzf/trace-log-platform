# DB-009 - 任务设计(D1)

## 基本信息
- Task ID: DB-009
- Owner: BE-2
- 日期: 2026-04-20
- 状态: Done

## 关联
- 关联需求: REQ-021
- 关联任务: 高频查询性能治理

## 变更目标
为高频查询补全复合索引，并引入 `EXPLAIN QUERY PLAN` 自动校验，避免后续变更引入全表扫描回退。

## 变更范围
- In scope:
  - 新增 `004_query_index_tuning` 迁移
  - 覆盖 `project/issue/executor_profile/audit_log` 高频查询索引
  - 新增 explain 校验脚本与自动化测试
- Out of scope:
  - 线上真实数据压测
  - 数据库分区和冷热分层

## 风险与回退
- 风险：索引过多可能增加写入开销
- 回退方案：按迁移粒度回滚 `004_query_index_tuning`
