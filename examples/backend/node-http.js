import http from "node:http";

import { createBackendLogClient } from "@traceai/trace-log-sdk";

const client = createBackendLogClient({
  platformBaseUrl: "https://trace.example.com",
  serviceName: "inventory-service",
});

const server = http.createServer(async (req, res) => {
  const tracer = client.createHttpRequestTracer(req.headers);
  const startedAt = Date.now();

  try {
    await tracer.reportStart({ method: req.method, path: req.url });

    if (req.url === "/inventory/fail") {
      throw new Error("inventory db timeout");
    }

    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));

    await tracer.reportEnd({
      method: req.method,
      path: req.url,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    res.statusCode = 500;
    res.end("internal error");

    await tracer.reportError(error, {
      method: req.method,
      path: req.url,
      statusCode: 500,
      durationMs: Date.now() - startedAt,
    });
  }
});

server.listen(4100);
