# Language Onboarding Matrix

## Supported Integration Paths

| Language/Stack | Integration Pattern | Request Middleware | Package Coordinate |
|---|---|---|---|
| JavaScript (Browser) | SDK Script | N/A | `https://trace.example.com/packages/javascript/trace-log-frontend-sdk-1.0.0.js` |
| Node.js | NPM Package | Yes | `@traceai/trace-log-sdk` |
| Python | `pip` Package | Yes (Flask/FastAPI) | `trace-log-sdk` |
| Java | Maven Starter | Yes (Spring Boot Auto Filter) | `com.traceai:trace-log-spring-boot-starter:1.0.0` |
| cURL / any HTTP | Raw API (fallback only) | N/A | N/A |

## Standard Ingest Payload

```json
{
  "traceId": "tr_xxx",
  "spanId": "sp_xxx",
  "parentSpanId": "sp_parent",
  "level": "error",
  "message": "db timeout",
  "service": "order-service",
  "source": "backend",
  "path": "/orders",
  "method": "POST",
  "statusCode": 500,
  "timestamp": "2026-04-14T07:00:00.000Z",
  "error": {
    "name": "TimeoutError",
    "message": "db timeout",
    "stack": ""
  },
  "meta": {
    "region": "cn-shanghai"
  }
}
```

## Mandatory Fields

- `traceId`
- `spanId`
- `level`
- `message`
- `service`
- `source`

## Recommended Headers

- `x-trace-id`
- `x-parent-span-id`
- `traceparent`
