# System Architecture

## 1. 目标

构建可持续运行的日志与修复协同平台，闭环能力包括：
日志采集 -> 链路聚合 -> 异常分析 -> 修复任务输出 -> 状态回写。

## 2. 核心模块

- `Ingestion Layer`
  - 前端入口：`/v1/logs/frontend`
  - 后端入口：`/v1/logs/backend`
  - 批量入口：`/v1/logs/batch`
- `Trace & Query Layer`
  - 链路查询：`/v1/traces`, `/v1/traces/{traceId}`
  - 日志检索：`/v1/logs`
- `Analysis Layer`
  - 手动分析：`/v1/analyze`
  - 自动分析调度：`AnalysisScheduler`
- `Bug & Repair Task Layer`
  - Bug：`/v1/bugs`
  - 任务：`/v1/repair-tasks`, claim/patch
- `Dashboard Layer`
  - 汇总：`/v1/dashboard/full`
  - 趋势/服务/Top异常拆分接口

## 3. Trace 传播规范

支持：
- `x-trace-id`
- `x-parent-span-id`
- `traceparent`（W3C）

平台会统一入库字段：
- `traceId`
- `spanId`
- `parentSpanId`
- `service`
- `source`

## 4. 数据模型（MVP）

- LogRecord
- BugReport
- RepairTask

当前存储实现为本地文件型（`data/platform-store.json`），可替换为数据库/Kafka pipeline。

## 5. 可扩展方向

- 多租户与鉴权
- 告警与通知（Webhook/IM）
- 与 CI/CD 平台联动触发回滚或灰度
- 异常聚类模型从规则升级为 LLM + embedding
