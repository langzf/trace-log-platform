# Deployment Runbook

## 1. 环境要求

- Node.js >= 20
- Linux/macOS
- sqlite3 >= 3.35

## 2. 环境变量

参考 `.env.example`：
- `PORT` 服务端口
- `HOST` 监听地址
- `AUTO_ANALYZE` 是否自动分析
- `ANALYZE_INTERVAL_MS` 自动分析间隔
- `ENABLE_SQLITE_AUDIT` 是否启用 sqlite 审计落盘（1 启用）
- `AUDIT_DB_PATH` sqlite 审计数据库路径
- `QUEUE_MAX_ATTEMPTS` 队列消息最大重试次数（超过进入 DLQ）
- `OPENCLAW_INSTALL_COMMAND` OpenClaw 安装命令
- `OPENCLAW_INSTALL_SCRIPT` OpenClaw 默认安装脚本路径（默认 `scripts/openclaw/install_openclaw.sh`）
- `OPENCLAW_INSTALL_METHOD` 安装策略（`auto|brew|binary|bootstrap`）
- `OPENCLAW_TARGET_VERSION` 目标版本（可选）
- `OPENCLAW_BINARY_URL` 二进制制品 URL（`binary` 模式必填）
- `OPENCLAW_BINARY_SHA256` 二进制 SHA256（建议必填）
- `OPENCLAW_BOOTSTRAP_URL` 引导脚本 URL（`bootstrap` 模式必填）
- `OPENCLAW_INSTALL_DIR` 安装目录（如 `/usr/local/bin`）
- `OPENCLAW_EXPECT_HEALTH` 是否强制健康检查（`1/0`）
- `OPENCLAW_POST_INSTALL_COMMAND` 安装后命令（如启动/重启服务）
- `OPENCLAW_CHECK_COMMAND` OpenClaw 版本检查命令
- `OPENCLAW_ENDPOINT` OpenClaw 网关地址
- `OPENCLAW_HEALTH_PATH` OpenClaw 健康检查路径
- `REPAIR_RECEIVER_BASE_URL` 修复接收器地址

## 3. 启动

```bash
npm run db:migrate
npm start
```

## 4. 健康检查

```bash
curl -sS http://127.0.0.1:3000/health
```

## 5. 发布前检查

```bash
npm test
npm run smoke
npm run db:migrate:status
npm run db:explain
```

## 6. 运行中操作

- 暂停自动分析：`POST /v1/system/analyzer/stop`
- 恢复自动分析：`POST /v1/system/analyzer/start`
- 手工执行分析：`POST /v1/analyze`
- 审计查询：`GET /v1/audit-logs`
- 队列主题状态：`GET /v1/system/queue/topics`
- 查看死信：`GET /v1/system/queue/dlq?topic=<topic>`
- OpenClaw 状态：`GET /v1/system/openclaw/status`
- OpenClaw 一键安装：`POST /v1/system/openclaw/install`
  - 推荐传参：`installMode/binaryUrl/binarySha256/targetVersion`
  - 仅在特殊场景使用 `installCommand` 原始命令透传

## 7. 失败排查

- 看板打不开：检查 `/health` 和端口监听
- 无任务产出：先确认有 error 日志，再触发 `/v1/analyze`
- trace 串不起来：检查请求头是否传递 `x-trace-id` 与 `x-parent-span-id`
- 迁移失败：执行 `node scripts/db/migrate.js status --db <db_path>` 检查版本停留点

## 8. 数据库迁移管理

- 执行迁移：`npm run db:migrate`
- 查看状态：`npm run db:migrate:status`
- 回滚一步：`npm run db:migrate:down`
- 指定数据库：

```bash
node scripts/db/migrate.js up --db /var/lib/trace-log/platform.db
```
