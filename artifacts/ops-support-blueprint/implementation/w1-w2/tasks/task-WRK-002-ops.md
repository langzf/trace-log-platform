# WRK-002 - 运维说明(D5)

## 基本信息
- Task ID: WRK-002
- Owner: AI-1
- 日期: 2026-04-21
- 状态: Done

## 契约规范
- 统一 envelope 字段：
  - `id`, `envelopeVersion`, `eventVersion`, `topic`, `eventType`, `producer`, `timestamp`, `payload`
- 当前默认：
  - `envelopeVersion = 1.0`
  - `eventVersion = v1`

## 发布规范
- 业务事件通过 `buildEventEnvelope` 构建
- 发布前通过 `validateEventEnvelope` 校验
- 失败消息进入 `ops.dlq.<topic>`

## 运维约束
- 发布新版本事件应先灰度，保持旧字段兼容
- 非破坏新增可在 `payload` 或 `metadata` 扩展字段

## 验证入口
- 自动化：`test/queue-system.test.js`
- 手工：`POST /v1/system/queue/publish` + `POST /v1/system/queue/process-next`
