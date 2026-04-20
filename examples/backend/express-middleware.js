import express from "express";

import { createBackendLogClient } from "@traceai/backend-sdk";

const app = express();
const logClient = createBackendLogClient({
  platformBaseUrl: "https://trace.example.com",
  serviceName: "order-service",
});

app.use(async (req, res, next) => {
  const tracer = logClient.createHttpRequestTracer(req.headers);
  req.traceContext = tracer.traceContext;

  const startedAt = Date.now();
  await tracer.reportStart({ method: req.method, path: req.path });

  res.on("finish", async () => {
    await tracer.reportEnd({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

app.get("/orders/:id", async (req, res) => {
  try {
    // Your business logic...
    res.json({ ok: true, id: req.params.id });
  } catch (error) {
    await logClient.report({
      level: "error",
      message: "query order failed",
      traceContext: req.traceContext,
      error,
      path: req.path,
      method: req.method,
      statusCode: 500,
      meta: { orderId: req.params.id },
    });
    res.status(500).json({ ok: false });
  }
});

process.on("SIGTERM", async () => {
  await logClient.shutdown();
  process.exit(0);
});
