# WRK-002 - 变更记录(D6)

## 基本信息
- Task ID: WRK-002
- Owner: AI-1
- 日期: 2026-04-21
- 状态: Done

## 代码变更
- 新增契约模块：`src/core/event-envelope.js`
- 服务接入 envelope 发布：`src/server.js`
  - issue/config/model_policy 等关键事件自动发布
- 新增测试：`test/queue-system.test.js`

## 影响范围
- 消息格式统一，可支撑后续多 worker/多版本演进。

## 回滚点
- 停用 envelope 校验并回退到原始 payload 发布。
