# Trace Log Platform

可实施的链路日志与自动修复协同平台。

## What You Get

- 模块化控制台（Dashboard / Trace Explorer / Bug Center / Task Center / Integration Hub / Traffic Lab）
- 前后端统一 trace 传播与日志接入
- 异常聚类分析、Bug 生成、修复任务编排
- 自动分析调度（可开关）
- 多语言 SDK 接入（JavaScript / Python / Java）

## Console

- URL: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- Health: [http://127.0.0.1:3000/health](http://127.0.0.1:3000/health)

## Quick Start

```bash
npm start
```

## External Integration (Package First)

Use your platform domain, for example `https://trace.example.com`.

### JavaScript (Browser)

```html
<script src="https://trace.example.com/sdk/frontend.js"></script>
<script>
  const client = window.TraceLogSDK.createClient({
    platformBaseUrl: "https://trace.example.com",
    appName: "checkout-web"
  });

  const trace = client.startTrace({ feature: "checkout" });
  client.tracedFetch("https://api.example.com/orders", { method: "POST" }, trace);
</script>
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

- Ingest: `POST /v1/logs/frontend`, `POST /v1/logs/backend`, `POST /v1/logs/batch`
- Query: `GET /v1/logs`, `GET /v1/traces`, `GET /v1/traces/{traceId}`, `GET /v1/services`
- Analyze: `POST /v1/analyze`
- Bug/Task: `GET /v1/bugs`, `GET /v1/repair-tasks`, `POST /v1/repair-tasks/{taskId}/claim`, `PATCH /v1/repair-tasks/{taskId}`
- Ops: `GET /v1/dashboard/full`, `POST /v1/system/analyzer/start`, `POST /v1/system/analyzer/stop`, `POST /v1/system/reset`

## SDK Workspace

- Python SDK source: `sdks/python`
- Java SDK source: `sdks/java/trace-log-sdk`
- Java Spring Starter source: `sdks/java/trace-log-spring-boot-starter`

## Configuration

See `.env.example`:
- `PORT`
- `HOST`
- `AUTO_ANALYZE`
- `ANALYZE_INTERVAL_MS`

## Validation

```bash
npm test
npm run smoke
```

## Docs

- Integration Guide: `docs/integration-guide.md`
- Language Matrix: `docs/language-onboarding.md`
- System Architecture: `docs/system-architecture.md`
- Deployment Runbook: `docs/deployment-runbook.md`
- OpenAPI: `artifacts/api/openapi.yaml`
