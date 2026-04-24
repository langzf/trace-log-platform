# Trace Log Platform

可实施的链路日志与自动修复协同平台。

## What You Get

- 模块化控制台（Dashboard / Trace Explorer / Bug Center / Task Center / Collector Center / Integration Hub / Traffic Lab）
- 前后端统一 trace 传播与日志接入
- 多模式日志采集（SDK 推送 + 平台侧拉取 + Syslog 转发 + 边车脚本推送）
- 异常聚类分析、Bug 生成、修复任务编排
- 自动分析调度（可开关）
- 多语言 SDK 接入（JavaScript / Python / Java）

## Console

- URL: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- Health: [http://127.0.0.1:3000/health](http://127.0.0.1:3000/health)

## Quick Start

```bash
npm run db:migrate
npm run sdk:package
npm start
```

## External Integration (Package First)

Use your platform domain, for example `https://trace.example.com`.

### JavaScript (Browser)

```html
<script src="https://trace.example.com/packages/javascript/trace-log-frontend-sdk-1.0.0.js"></script>
<script>
  const client = window.TraceLogSDK.createClient({
    platformBaseUrl: "https://trace.example.com",
    appName: "checkout-web"
  });

  const trace = client.startTrace({ feature: "checkout" });
  client.tracedFetch("https://api.example.com/orders", { method: "POST" }, trace);
</script>
```

### JavaScript / Node.js (`npm`)

```bash
npm install @traceai/trace-log-sdk
```

```js
import { createBackendLogClient } from "@traceai/trace-log-sdk";

const client = createBackendLogClient({
  platformBaseUrl: "https://trace.example.com",
  serviceName: "node-order-service",
});
```

### Python (`pip`)

```bash
pip install trace-log-sdk
```

```python
from trace_log_sdk import TraceLogClient

client = TraceLogClient(
    base_url="https://trace.example.com",
    service_name="python-order-service",
)

trace = client.new_trace()
client.report("info", "create_order_start", trace, path="/orders", method="POST")
```

### Java (Maven)

```xml
<dependency>
  <groupId>com.traceai</groupId>
  <artifactId>trace-log-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>
```

```yaml
trace:
  log:
    platform-base-url: https://trace.example.com
    service-name: java-order-service
```

## Core APIs

- Event/Issue: `POST /v1/events`, `GET /v1/issues`, `GET /v1/issues/{issueId}`
- Config: `GET/POST /v1/config/executors`, `GET/POST /v1/config/projects`, `GET/POST /v1/config/model-policies`
- Collectors: `GET /v1/log-collectors/capabilities`, `GET/POST /v1/config/log-collectors`, `DELETE /v1/config/log-collectors/{collectorKey}`, `POST /v1/config/log-collectors/{collectorKey}/run`, `GET /v1/log-collector-runs`, `GET /v1/system/collectors/state`
- Audit: `GET /v1/audit-logs`
- Queue: `GET /v1/system/queue/topics`, `POST /v1/system/queue/publish`, `POST /v1/system/queue/process-next`, `GET /v1/system/queue/dlq`
- Integration: `GET /v1/integration/packages`
- System Scope: `GET /v1/system/contexts`
- OpenClaw: `GET /v1/system/openclaw/status`, `POST /v1/system/openclaw/install`
- Ingest: `POST /v1/logs/frontend`, `POST /v1/logs/backend`, `POST /v1/logs/batch`, `POST /v1/logs/syslog`
- Query: `GET /v1/logs`, `GET /v1/traces`, `GET /v1/traces/{traceId}`, `GET /v1/services`
- Analyze: `POST /v1/analyze`
- Bug/Task: `GET /v1/bugs`, `GET /v1/repair-tasks`, `POST /v1/repair-tasks/{taskId}/claim`, `PATCH /v1/repair-tasks/{taskId}`
- Ops: `GET /v1/dashboard/full`, `POST /v1/system/analyzer/start`, `POST /v1/system/analyzer/stop`, `POST /v1/system/reset`

## SDK Workspace

- JavaScript SDK source: `sdks/javascript/trace-log-sdk`
- Python SDK source: `sdks/python`
- Java SDK source: `sdks/java/trace-log-sdk`
- Java Spring Starter source: `sdks/java/trace-log-spring-boot-starter`

## Package Build Output

```bash
npm run sdk:package
```

- Generated package files: `public/packages/*`
- Generated package catalog: `public/packages/index.json`
- Download API index: `GET /v1/integration/packages`

## Configuration

See `.env.example`:
- `PORT`
- `HOST`
- `AUTO_ANALYZE`
- `ANALYZE_INTERVAL_MS`
- `ENABLE_SQLITE_AUDIT`
- `AUDIT_DB_PATH`
- `QUEUE_MAX_ATTEMPTS`
- `ENABLE_LOG_COLLECTOR_SCHEDULER`
- `LOG_COLLECTOR_TICK_INTERVAL_MS`
- `OPENCLAW_INSTALL_COMMAND`
- `OPENCLAW_INSTALL_SCRIPT`
- `OPENCLAW_INSTALL_METHOD`
- `OPENCLAW_TARGET_VERSION`
- `OPENCLAW_BINARY_URL`
- `OPENCLAW_BINARY_SHA256`
- `OPENCLAW_BOOTSTRAP_URL`
- `OPENCLAW_INSTALL_DIR`
- `OPENCLAW_EXPECT_HEALTH`
- `OPENCLAW_POST_INSTALL_COMMAND`
- `OPENCLAW_CHECK_COMMAND`
- `OPENCLAW_ENDPOINT`
- `OPENCLAW_HEALTH_PATH`
- `REPAIR_RECEIVER_BASE_URL`

## Validation

```bash
npm test
npm run smoke
```

## Database Migrations

```bash
npm run db:migrate
npm run db:migrate:status
npm run db:migrate:down
npm run db:explain
```

默认数据库文件路径为 `data/platform.db`，也可以通过命令行覆盖：

```bash
node scripts/db/migrate.js up --db /path/to/platform.db
```

## One-Click OpenClaw Install

```bash
npm run openclaw:install
npm run openclaw:install:dry
```

默认使用生产安装脚本 [scripts/openclaw/install_openclaw.sh](/Users/langzhifa/workspaces/trace_log_platform/scripts/openclaw/install_openclaw.sh)，支持：
- `auto`：自动选择安装方式（优先 brew，其次 binary/bootstrap）
- `brew`：使用 Homebrew 安装/升级
- `binary`：按制品 URL 下载并校验 SHA256 后安装
- `bootstrap`：执行引导安装脚本 URL

推荐通过结构化参数调用接口（避免手写 shell）：

```bash
curl -X POST http://127.0.0.1:3000/v1/system/openclaw/install \
  -H 'content-type: application/json' \
  -d '{
    "dryRun": false,
    "installMode": "binary",
    "binaryUrl": "https://artifact.example.com/openclaw/openclaw-darwin-arm64.tar.gz",
    "binarySha256": "9f1cf0...<64hex>",
    "targetVersion": "2026.3.13",
    "expectHealth": true,
    "postInstallCommand": "brew services restart openclaw",
    "endpoint": "http://127.0.0.1:18789",
    "executorKey": "openclaw-local",
    "autoRegisterExecutor": true,
    "syncToRepairReceiver": true,
    "repairReceiverBaseUrl": "http://127.0.0.1:8788"
  }'
```

如需完全自定义安装流程，仍可使用 `installCommand` 透传。

## Sidecar Log Shipper (存量系统附属脚本)

```bash
PLATFORM_URL=http://127.0.0.1:3000 \
FILE_PATH=/var/log/nginx/access.log \
SERVICE=nginx-gateway \
node scripts/log-agent/file-shipper.js
```

## Collector Modes

- `local_file`: 本机文件增量采集
- `command_pull`: 命令拉取（可通过 ssh 读取远端日志）
- `journald`: systemd journal 采集（Linux）
- `oss_pull`: 对象存储 URL 增量拉取（支持 Range）
- `syslog_http`: Syslog HTTP 转发（不改应用代码）

## Docs

- Integration Guide: `docs/integration-guide.md`
- Language Matrix: `docs/language-onboarding.md`
- System Architecture: `docs/system-architecture.md`
- Deployment Runbook: `docs/deployment-runbook.md`
- Multi-Source Log Collection Design: `docs/log-collection-multi-source-design.md`
- SDK Package Distribution Design: `docs/sdk-package-distribution-design.md`
- System Scope Linked Dashboard Design: `docs/system-scope-linked-dashboard-design.md`
- OpenAPI: `artifacts/api/openapi.yaml`
