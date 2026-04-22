# API-012 - 任务设计(D1)

## 基本信息
- Task ID: API-012
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 关联
- 关联需求: REQ-010
- 关联接口: `GET/POST /v1/config/executors`

## 变更目标
提供执行器注册中心读写接口，使接收器系统可维护可用执行器池（OpenClaw + Codex/Claude Code 等）。

## 变更范围
- In scope:
  - 新增执行器配置持久化结构（`executors`）
  - 新增 `GET /v1/config/executors` 列表查询
  - 新增 `POST /v1/config/executors` upsert
  - 支持按 `enabled/kind` 过滤
- Out of scope:
  - 执行器健康探测与自动摘除
  - 凭据加密与鉴权

## 风险与回退
- 风险：执行器元数据配置错误导致后续调度失败
- 回退方案：回退配置接口并使用静态配置文件
