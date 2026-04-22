# W1-W2 变更记录

| 日期 | Task ID | 变更摘要 | 影响范围 | 回滚点 | 负责人 |
|---|---|---|---|---|---|
| 2026-04-20 | INIT | 初始化 W1-W2 任务与文档框架 | 规划文档 | N/A | TL |
| 2026-04-20 | API-001 | 新增 `/v1/events` 入站与参数校验，生成 issueId | `src/server.js`, `src/core/storage.js`, `test/events-api.test.js` | 移除 `/v1/events` 路由 | BE-1 |
| 2026-04-20 | API-002 | 新增 `Idempotency-Key` 重放/冲突机制（ERR-1002） | `src/server.js`, `src/core/storage.js`, `test/events-api.test.js` | 关闭幂等键逻辑 | BE-1 |
| 2026-04-20 | API-003 | 新增 `/v1/issues` 列表查询并修复默认 `limit` 解析为 0 的缺陷 | `src/server.js`, `test/events-api.test.js` | 移除 `/v1/issues` 路由并回退 `asInt` | BE-1 |
| 2026-04-20 | API-004 | 新增 `/v1/issues/{issueId}` 详情查询与 `ERR-1003` | `src/server.js`, `src/core/storage.js`, `test/events-api.test.js` | 移除 issue 详情路由 | BE-1 |
| 2026-04-20 | API-012 | 新增 `/v1/config/executors` 读写接口与配置持久化 | `src/server.js`, `src/core/storage.js`, `test/config-api.test.js` | 移除 executors 配置路由与状态字段 | BE-1 |
| 2026-04-20 | API-013 | 新增 `/v1/config/projects` 读写接口与项目配置持久化 | `src/server.js`, `src/core/storage.js`, `test/config-api.test.js` | 移除 projects 配置路由与状态字段 | BE-1 |
| 2026-04-20 | DB-001 | 新增 `project/issue/cluster` 迁移与 schema 版本跟踪脚本 | `db/migrations/001_project_issue_cluster/*`, `scripts/db/migrate.js`, `test/db-migration.test.js` | 回滚 `down --steps 1` | BE-2 |
| 2026-04-20 | DB-007 | 新增 `executor_profile` 迁移（含优先级索引） | `db/migrations/002_executor_profile/*`, `scripts/db/migrate.js`, `test/db-migration.test.js` | 回滚 `down --steps 1` | BE-2 |
| 2026-04-20 | DB-002 | 新增 `audit_log` 迁移、审计写入链路与查询接口 | `db/migrations/003_audit_log/*`, `src/server.js`, `src/core/storage.js`, `src/core/sqlite-audit-sink.js`, `test/audit-api.test.js` | 关闭 sqlite 审计并回滚 `down --steps 1` | BE-2 |
| 2026-04-20 | DB-009 | 新增高频查询索引迁移与 explain 自动校验 | `db/migrations/004_query_index_tuning/*`, `scripts/db/explain-check.js`, `test/db-explain.test.js` | 回滚 `down --steps 1` | BE-2 |
| 2026-04-21 | DB-008 | 新增 `model_policy` 迁移与 `config/model-policies` 配置接口 | `db/migrations/005_model_policy/*`, `src/core/storage.js`, `src/server.js`, `test/model-policy-api.test.js` | 回滚 `down --steps 1` | BE-2 |
| 2026-04-21 | WRK-001 | 新增内存 topic 队列、DLQ 与队列管理 API | `src/core/topic-queue.js`, `src/server.js`, `test/queue-system.test.js` | 移除 queue API 和 topic-queue 模块 | AI-1 |
| 2026-04-21 | WRK-002 | 新增统一 envelope 契约与 eventVersion，关键事件改为 envelope 发布 | `src/core/event-envelope.js`, `src/server.js`, `test/queue-system.test.js` | 回退 envelope 构建与校验逻辑 | AI-1 |
| 2026-04-21 | OPS-003 | OpenClaw 一键安装升级为生产脚本：支持 auto/brew/binary/bootstrap、版本与校验、回滚与健康检查，接口改为结构化安装参数 | `scripts/openclaw/install_openclaw.sh`, `src/server.js`, `scripts/openclaw/one-click-install.js`, `test/openclaw-system.test.js`, `docs/deployment-runbook.md`, `README.md`, `artifacts/api/openapi.yaml` | 回退到 `installCommand` 透传模式并移除生产安装脚本 | SRE |
