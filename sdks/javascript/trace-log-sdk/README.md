# @traceai/trace-log-sdk

Trace Log Platform JavaScript SDK package.

## Install

```bash
npm install @traceai/trace-log-sdk
```

## Node.js Quick Start

```js
import { createBackendLogClient } from "@traceai/trace-log-sdk";

const client = createBackendLogClient({
  platformBaseUrl: "https://trace.example.com",
  serviceName: "order-service",
});

const tracer = client.createHttpRequestTracer({
  "x-trace-id": "tr_demo_001",
});

await tracer.reportStart({ method: "GET", path: "/orders/1" });
await tracer.reportEnd({ method: "GET", path: "/orders/1", statusCode: 200 });
await client.shutdown();
```

## Browser (ESM) Quick Start

```js
import { createClient } from "@traceai/trace-log-sdk/browser";

const client = createClient({
  platformBaseUrl: "https://trace.example.com",
  appName: "checkout-web",
});

const trace = client.startTrace({ feature: "checkout" });
await client.tracedFetch("https://api.example.com/orders", { method: "POST" }, trace);
```
