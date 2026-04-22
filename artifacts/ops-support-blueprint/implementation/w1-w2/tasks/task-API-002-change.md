# API-002 - 变更记录(D6)

## 基本信息
- Task ID: API-002
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 代码变更
- `src/core/storage.js`
  - 新增 `checkIdempotencyKey` / `bindIdempotencyKey`
- `src/server.js`
  - 新增 `Idempotency-Key` 读取、冲突判断与重放逻辑
- `test/events-api.test.js`
  - 新增幂等重放与冲突测试

## 回滚点
- 关闭 `Idempotency-Key` 路径逻辑并保留 eventId 去重。
