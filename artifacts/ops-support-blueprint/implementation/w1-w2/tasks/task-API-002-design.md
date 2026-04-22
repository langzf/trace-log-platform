# API-002 - 任务设计(D1)

## 基本信息
- Task ID: API-002
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 关联
- 关联需求: REQ-003
- 关联接口: `POST /v1/events` + `Idempotency-Key`

## 变更目标
实现幂等键机制，支持请求重放与冲突检测，避免重复任务写入。

## 变更范围
- In scope:
  - `Idempotency-Key` 检查与绑定
  - 同键同体重放返回 `deduplicated=true`
  - 同键异体冲突返回 `ERR-1002`
- Out of scope:
  - 幂等记录 TTL 清理（后续任务）

## 风险与回退
- 风险：客户端错误复用幂等键可能触发冲突
- 预案：返回明确错误码与 issueId 供调用方排查
