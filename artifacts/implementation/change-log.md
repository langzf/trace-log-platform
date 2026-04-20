# 变更记录

- 重构 `src/server.js` 为实施级 API：新增批量接入、链路汇总、看板聚合、分析调度、任务认领和状态流转。
- 重构 `src/core/storage.js`：新增过滤查询、服务健康、错误趋势、Top异常统计和任务优先级。
- 新增 `src/core/analysis-scheduler.js`：自动分析调度。
- 升级 `src/core/trace.js`：支持 `traceparent`。
- 升级 `src/sdk/frontend-sdk.js`：批量缓冲、自动 flush、全局异常捕获。
- 升级 `src/sdk/backend-sdk.js`：批量上报与请求生命周期 tracing 辅助。
- 重做 `public/index.html` + `public/app.js` + `public/styles.css`：运营控制台可视化。
- 新增 `examples/`：React/Vue/Express/Koa/Node 接入示例。
- 新增 `docs/`：集成指南、架构说明、部署手册。
- 更新测试与冒烟脚本，验证任务流转和 dashboard 接口。
