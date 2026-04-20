import Koa from "koa";
import Router from "@koa/router";

import { createBackendLogClient } from "@traceai/backend-sdk";

const app = new Koa();
const router = new Router();

const logClient = createBackendLogClient({
  platformBaseUrl: "https://trace.example.com",
  serviceName: "payment-service",
});

app.use(async (ctx, next) => {
  const tracer = logClient.createHttpRequestTracer(ctx.request.headers);
  const startedAt = Date.now();

  await tracer.reportStart({ method: ctx.method, path: ctx.path });

  try {
    await next();
    await tracer.reportEnd({
      method: ctx.method,
      path: ctx.path,
      statusCode: ctx.status,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    await tracer.reportError(error, {
      method: ctx.method,
      path: ctx.path,
      statusCode: 500,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
});

router.get("/health", (ctx) => {
  ctx.body = { ok: true };
});

app.use(router.routes());
app.listen(4000);
