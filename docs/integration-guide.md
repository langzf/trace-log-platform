# Integration Guide (External Teams)

> This guide is designed for external integrators. Replace `https://trace.example.com` with your platform domain.

## 1. Integration Strategy (Recommended Order)

1. SDK/Starter package integration (recommended)
2. Browser SDK script integration
3. Raw HTTP API call (fallback only)

## 2. Platform Endpoint Contract

- Base URL: `https://trace.example.com`
- Package registry:
  - `GET /v1/integration/packages`
  - Static package files under `/packages/*`
- Single ingest:
  - `POST /v1/logs/frontend`
  - `POST /v1/logs/backend`
- Batch ingest:
  - `POST /v1/logs/batch`
- Trace query:
  - `GET /v1/traces`
  - `GET /v1/traces/{traceId}`
- Analysis + repair:
  - `POST /v1/analyze`
  - `GET /v1/repair-tasks`
  - `POST /v1/repair-tasks/{taskId}/claim`
  - `PATCH /v1/repair-tasks/{taskId}`

## 3. Trace Propagation Standard

Forward these headers through your service chain:
- `x-trace-id`
- `x-parent-span-id`
- `traceparent` (optional, supported)

## 4. Download Real SDK Packages

1. Pull package catalog:

```bash
curl https://trace.example.com/v1/integration/packages
```

2. Install by package URL:

```bash
npm install https://trace.example.com/packages/javascript/<tarball>.tgz
pip install https://trace.example.com/packages/python/<wheel>.whl
```

## 5. Frontend Integration (JavaScript)

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

## 6. Backend Integration (Python SDK)

Install:

```bash
pip install trace-log-sdk
```

Use in code:

```python
from trace_log_sdk import TraceLogClient

client = TraceLogClient(
    base_url="https://trace.example.com",
    service_name="python-order-service",
    batch_size=30,
    flush_interval=1.0,
)

trace = client.new_trace()
client.report("info", "create_order_start", trace, path="/orders", method="POST")
```

Flask/FastAPI middleware examples:
- `examples/python/flask_integration.py`
- `examples/python/fastapi_integration.py`

SDK source package:
- `sdks/python`

## 7. Backend Integration (Java Spring Boot Starter)

Maven dependency:

```xml
<dependency>
  <groupId>com.traceai</groupId>
  <artifactId>trace-log-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>
```

Configuration:

```yaml
trace:
  log:
    platform-base-url: https://trace.example.com
    service-name: java-order-service
```

After dependency + config, starter auto registers:
- request trace filter
- async batch log report client

Spring Boot example:
- `examples/java/springboot`

SDK source package:
- `sdks/java/trace-log-sdk`
- `sdks/java/trace-log-spring-boot-starter`

## 8. Repair Bot Integration Flow

1. Poll pending tasks: `GET /v1/repair-tasks?status=pending`
2. Claim task: `POST /v1/repair-tasks/{taskId}/claim`
3. Submit state updates: `PATCH /v1/repair-tasks/{taskId}`
4. Recommended status flow:
   - `pending -> in_progress -> deployed -> verified`
   - `pending/in_progress -> failed`

## 9. Operational Endpoints

- Full dashboard payload: `GET /v1/dashboard/full`
- Analyzer controls:
  - `POST /v1/system/analyzer/start`
  - `POST /v1/system/analyzer/stop`
  - `POST /v1/system/analyzer/tick`
  - `GET /v1/system/analyzer/state`
