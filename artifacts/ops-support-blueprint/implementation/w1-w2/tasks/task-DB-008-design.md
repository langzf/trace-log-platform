# DB-008 - 任务设计(D1)

## 基本信息
- Task ID: DB-008
- Owner: BE-2
- 日期: 2026-04-21
- 状态: Done

## 关联
- 关联需求: REQ-020
- 关联表: `model_policy`

## 变更目标
落地模型路由策略持久化表，支撑按项目配置默认模型层级、升级规则和预算约束。

## 变更范围
- In scope:
  - 新增 `005_model_policy` 迁移（up/down）
  - 新增 `GET/POST /v1/config/model-policies`
  - 配置 upsert 后写审计并发布 queue 事件
- Out of scope:
  - 实际路由引擎执行（RT-001）
  - 预算熔断执行（WRK-010）

## 风险与回退
- 风险：错误策略可能触发模型成本异常
- 回退方案：回滚 `005_model_policy` 并删除对应配置数据
