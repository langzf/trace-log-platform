# 验收标准（Given/When/Then）

## REQ-001
Given 前端页面集成 SDK
When 用户触发 tracedFetch 请求
Then 平台收到 `/v1/logs/frontend` 日志，且包含 traceId/spanId。

## REQ-002
Given 后端收到带 `x-trace-id` 的请求
When 后端处理并记录日志
Then 日志记录中 traceId 与请求头一致，且生成服务端 span。

## REQ-003
Given 某条链路 traceId 已存在日志
When 调用 `/v1/traces/{traceId}`
Then 返回按时间排序的完整链路日志集合。

## REQ-004
Given 系统存在 error 级日志
When 调用 `/v1/analyze`
Then 返回 bugReports，且每条报告包含 fingerprint、severity、traceIds、recommendations。

## REQ-005
Given 已生成 bugReports
When 查询 `/v1/repair-tasks`
Then 返回 `payload` 中包含 bug 信息和样本日志引用。

## REQ-006
Given 前端接入 SDK
When 调用 `tracedFetch`
Then 请求头自动带 `x-trace-id` 和 `x-parent-span-id`。

## REQ-007
Given 后端服务接入 SDK
When 调用 report
Then 日志可写入平台后端日志接入 API。

## REQ-008
Given 执行 `npm test`
When 测试完成
Then 单元与端到端用例均通过。

## REQ-009
Given OpenClaw 目标节点已配置安装参数
When 调用 `/v1/system/openclaw/install`
Then 返回安装执行结果、健康状态与执行器注册结果。
