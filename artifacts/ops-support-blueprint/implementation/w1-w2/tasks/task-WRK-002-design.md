# WRK-002 - 任务设计(D1)

## 基本信息
- Task ID: WRK-002
- Owner: AI-1
- 日期: 2026-04-21
- 状态: Done

## 关联
- 关联需求: REQ-012
- 关联模块: event envelope contract

## 变更目标
定义统一 envelope 契约并引入 `eventVersion`，确保消息在 topic 间流转具备稳定结构和版本扩展能力。

## 变更范围
- In scope:
  - 新增 `buildEventEnvelope/validateEventEnvelope`
  - 业务关键事件统一使用 envelope 发布
  - `eventVersion` 与 `envelopeVersion` 在测试中校验
- Out of scope:
  - 历史版本兼容转换器
  - 多 schema registry 管理

## 风险与回退
- 风险：契约字段调整可能影响下游 worker 解析
- 回退方案：短期固定 `v1`，通过兼容字段回滚
