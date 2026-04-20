import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

import { analyzeExceptionLogs } from "./core/analyzer.js";
import { AnalysisScheduler } from "./core/analysis-scheduler.js";
import { generateId, nowIso } from "./core/ids.js";
import { FileBackedStore } from "./core/storage.js";
import { childSpan, createTraceContext, extractTraceHeaders } from "./core/trace.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const DEFAULT_HOST = process.env.HOST || "127.0.0.1";
const DEFAULT_DATA_FILE = path.join(__dirname, "..", "data", "platform-store.json");
const FRONTEND_SDK_FILE = path.join(__dirname, "sdk", "frontend-sdk.js");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const MAX_BODY_BYTES = 1024 * 1024 * 5;
const CONTENT_TYPE_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  res.statusCode = statusCode;
  res.setHeader("content-type", contentType);
  res.end(payload);
}

function asInt(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Payload too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON payload");
    error.statusCode = 400;
    throw error;
  }
}

async function maybeServeStatic(urlPath, res) {
  if (urlPath === "/sdk/frontend.js") {
    const content = await fs.readFile(FRONTEND_SDK_FILE, "utf8");
    sendText(res, 200, content, "application/javascript; charset=utf-8");
    return true;
  }

  let targetPath = urlPath;
  if (targetPath === "/") {
    targetPath = "/index.html";
  }

  const normalizedPath = path
    .normalize(targetPath)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return false;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXT[ext] || "application/octet-stream";
    const content = await fs.readFile(filePath);
    sendText(res, 200, content, contentType);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function sanitizeError(rawError) {
  if (!rawError) {
    return null;
  }

  return {
    name: rawError.name || "Error",
    message: rawError.message || String(rawError),
    stack: rawError.stack || "",
  };
}

function buildIngestedLog({ body, source, req }) {
  const traceContext = createTraceContext({
    traceId: body.traceId || req.headers["x-trace-id"] || undefined,
    parentSpanId: body.parentSpanId || req.headers["x-parent-span-id"] || undefined,
    service:
      body.service || req.headers["x-client-app"] || req.headers["x-service-name"] || `${source}-unknown-service`,
    source,
  });

  return {
    id: generateId("log_", 8),
    timestamp: body.timestamp || nowIso(),
    source,
    service: traceContext.service,
    traceId: traceContext.traceId,
    spanId: body.spanId || traceContext.spanId,
    parentSpanId: body.parentSpanId || traceContext.parentSpanId,
    level: body.level || "info",
    message: body.message || "",
    path: body.path || null,
    method: body.method || null,
    statusCode: body.statusCode || null,
    error: sanitizeError(body.error),
    meta: body.meta || {},
  };
}

function normalizeBatchPayload({ body, source, req }) {
  const rawLogs = Array.isArray(body.logs) ? body.logs : [];
  const logs = rawLogs.map((item) => buildIngestedLog({ body: item, source, req }));
  return logs;
}

function safeError(error) {
  return {
    name: error.name || "Error",
    message: error.message || String(error),
    stack: error.stack || "",
  };
}

function createRequestContext(req) {
  const incoming = extractTraceHeaders(req.headers);
  const traceContext = createTraceContext({
    traceId: incoming.traceId || undefined,
    parentSpanId: incoming.parentSpanId || undefined,
    service: "trace-log-platform",
    source: "backend",
  });

  return {
    traceContext,
    clientApp: incoming.clientApp,
  };
}

function createRequestLogger(store, req, routeContext) {
  return async function log(level, message, detail = {}) {
    await store.addLog({
      id: generateId("log_", 8),
      timestamp: nowIso(),
      source: "backend",
      service: "trace-log-platform",
      traceId: routeContext.traceContext.traceId,
      spanId: detail.spanId || routeContext.traceContext.spanId,
      parentSpanId:
        detail.parentSpanId !== undefined
          ? detail.parentSpanId
          : routeContext.traceContext.parentSpanId,
      level,
      message,
      path: detail.path || new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname,
      method: detail.method || req.method,
      statusCode: detail.statusCode || null,
      error: detail.error ? safeError(detail.error) : null,
      meta: {
        ...(detail.meta || {}),
        clientApp: routeContext.clientApp || null,
      },
    });
  };
}

async function writeSyntheticDownstreamLog(store, routeContext, req, message, level = "info", error = null) {
  const span = childSpan(routeContext.traceContext, "trace-log-platform-downstream");
  await store.addLog({
    id: generateId("log_", 8),
    timestamp: nowIso(),
    source: "backend",
    service: "trace-log-platform",
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    level,
    message,
    path: new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname,
    method: req.method,
    statusCode: null,
    error: error ? safeError(error) : null,
    meta: { segment: "downstream" },
  });
}

function dashboardPayload(store, scheduler) {
  return {
    generatedAt: nowIso(),
    overview: store.getOverview({ minutes: 60 }),
    errorTrend: store.getErrorTrend({ hours: 24, bucketMinutes: 60 }),
    services: store.getServiceOverview({ minutes: 60 }),
    topErrors: store.getTopErrors({ limit: 8, hours: 24 }),
    traces: store.listTraceSummaries({ limit: 20 }),
    bugs: store.listBugs().slice(0, 20),
    repairTasks: store.listRepairTasks().slice(0, 20),
    scheduler: scheduler.snapshot(),
  };
}

async function handleApiRoute(req, res, store, routeContext, scheduler) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === "GET" && pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "trace-log-platform",
      now: nowIso(),
      stats: store.getStats(),
      scheduler: scheduler.snapshot(),
    });
  }

  if (method === "POST" && pathname === "/v1/logs/frontend") {
    const body = await readJsonBody(req);
    const log = buildIngestedLog({ body, source: "frontend", req });
    await store.addLog(log);
    return sendJson(res, 201, { ok: true, logId: log.id, traceId: log.traceId });
  }

  if (method === "POST" && pathname === "/v1/logs/backend") {
    const body = await readJsonBody(req);
    const log = buildIngestedLog({ body, source: "backend", req });
    await store.addLog(log);
    return sendJson(res, 201, { ok: true, logId: log.id, traceId: log.traceId });
  }

  if (method === "POST" && pathname === "/v1/logs/batch") {
    const body = await readJsonBody(req);
    const source = body.source === "backend" ? "backend" : "frontend";
    const logs = normalizeBatchPayload({ body, source, req });
    if (logs.length === 0) {
      return sendJson(res, 400, { ok: false, error: "logs must be a non-empty array" });
    }
    await store.addLogs(logs);
    return sendJson(res, 201, { ok: true, count: logs.length });
  }

  if (method === "GET" && pathname === "/v1/services") {
    return sendJson(res, 200, {
      ok: true,
      services: store.listServices(),
    });
  }

  if (method === "GET" && pathname.startsWith("/v1/traces/")) {
    const traceId = decodeURIComponent(pathname.replace("/v1/traces/", ""));
    const logs = store.getTrace(traceId);
    return sendJson(res, 200, {
      ok: true,
      traceId,
      count: logs.length,
      logs,
    });
  }

  if (method === "GET" && pathname === "/v1/traces") {
    const traces = store.listTraceSummaries({
      limit: asInt(url.searchParams.get("limit"), 50),
      status: url.searchParams.get("status") || undefined,
      service: url.searchParams.get("service") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      keyword: url.searchParams.get("keyword") || undefined,
    });

    return sendJson(res, 200, {
      ok: true,
      count: traces.length,
      traces,
    });
  }

  if (method === "GET" && pathname === "/v1/logs") {
    const logs = store.listLogs({
      traceId: url.searchParams.get("traceId") || undefined,
      level: url.searchParams.get("level") || undefined,
      service: url.searchParams.get("service") || undefined,
      source: url.searchParams.get("source") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      keyword: url.searchParams.get("keyword") || undefined,
      limit: asInt(url.searchParams.get("limit"), 200),
    });

    return sendJson(res, 200, {
      ok: true,
      count: logs.length,
      logs,
    });
  }

  if (method === "POST" && pathname === "/v1/analyze") {
    const body = await readJsonBody(req);
    const result = analyzeExceptionLogs(store.listLogs({ limit: 20000 }), {
      since: body.since,
    });
    await store.saveAnalysisResult(result);
    return sendJson(res, 200, {
      ok: true,
      generatedAt: result.generatedAt,
      totalErrorLogs: result.totalErrorLogs,
      bugCount: result.bugReports.length,
      bugReports: result.bugReports,
    });
  }

  if (method === "GET" && pathname === "/v1/bugs") {
    const bugs = store.listBugs({
      status: url.searchParams.get("status") || undefined,
      severity: url.searchParams.get("severity") || undefined,
    });
    return sendJson(res, 200, {
      ok: true,
      count: bugs.length,
      bugs,
    });
  }

  if (method === "GET" && pathname.startsWith("/v1/bugs/")) {
    const bugId = decodeURIComponent(pathname.replace("/v1/bugs/", ""));
    const bug = store.getBugById(bugId);
    if (!bug) {
      return sendJson(res, 404, { ok: false, error: "Bug not found" });
    }
    return sendJson(res, 200, { ok: true, bug });
  }

  if (method === "GET" && pathname === "/v1/repair-tasks") {
    const tasks = store.listRepairTasks({
      status: url.searchParams.get("status") || undefined,
      severity: url.searchParams.get("severity") || undefined,
    });
    return sendJson(res, 200, {
      ok: true,
      count: tasks.length,
      tasks,
    });
  }

  if (method === "POST" && pathname.startsWith("/v1/repair-tasks/") && pathname.endsWith("/claim")) {
    const taskId = pathname.replace("/v1/repair-tasks/", "").replace("/claim", "");
    const body = await readJsonBody(req);
    const result = store.claimRepairTask(taskId, body.assignee);

    if (!result) {
      return sendJson(res, 404, { ok: false, error: "Task not found" });
    }
    if (result.error) {
      return sendJson(res, 409, { ok: false, error: result.error, task: result.task });
    }

    return sendJson(res, 200, { ok: true, task: result.task });
  }

  if (method === "PATCH" && pathname.startsWith("/v1/repair-tasks/")) {
    const taskId = pathname.replace("/v1/repair-tasks/", "");
    const body = await readJsonBody(req);
    const result = store.updateRepairTask(taskId, {
      status: body.status,
      note: body.note,
      assignee: body.assignee,
    });

    if (!result) {
      return sendJson(res, 404, {
        ok: false,
        error: "Task not found",
      });
    }

    if (result.error) {
      return sendJson(res, 400, { ok: false, error: result.error });
    }

    return sendJson(res, 200, {
      ok: true,
      task: result.task,
    });
  }

  if (method === "GET" && pathname === "/v1/dashboard/overview") {
    return sendJson(res, 200, { ok: true, overview: store.getOverview({ minutes: 60 }) });
  }

  if (method === "GET" && pathname === "/v1/dashboard/error-trend") {
    return sendJson(res, 200, {
      ok: true,
      points: store.getErrorTrend({
        hours: asInt(url.searchParams.get("hours"), 24),
        bucketMinutes: asInt(url.searchParams.get("bucketMinutes"), 60),
      }),
    });
  }

  if (method === "GET" && pathname === "/v1/dashboard/services") {
    return sendJson(res, 200, {
      ok: true,
      services: store.getServiceOverview({ minutes: asInt(url.searchParams.get("minutes"), 60) }),
    });
  }

  if (method === "GET" && pathname === "/v1/dashboard/top-errors") {
    return sendJson(res, 200, {
      ok: true,
      topErrors: store.getTopErrors({
        limit: asInt(url.searchParams.get("limit"), 10),
        hours: asInt(url.searchParams.get("hours"), 24),
      }),
    });
  }

  if (method === "GET" && pathname === "/v1/dashboard/full") {
    return sendJson(res, 200, { ok: true, ...dashboardPayload(store, scheduler) });
  }

  if (method === "POST" && pathname === "/v1/system/analyzer/start") {
    scheduler.start();
    return sendJson(res, 200, { ok: true, scheduler: scheduler.snapshot() });
  }

  if (method === "POST" && pathname === "/v1/system/analyzer/stop") {
    scheduler.stop();
    return sendJson(res, 200, { ok: true, scheduler: scheduler.snapshot() });
  }

  if (method === "POST" && pathname === "/v1/system/analyzer/tick") {
    await scheduler.tick();
    return sendJson(res, 200, { ok: true, scheduler: scheduler.snapshot() });
  }

  if (method === "GET" && pathname === "/v1/system/analyzer/state") {
    return sendJson(res, 200, { ok: true, scheduler: scheduler.snapshot() });
  }

  if (method === "POST" && pathname === "/v1/system/reset") {
    const body = await readJsonBody(req);
    if (body.confirm !== "RESET") {
      return sendJson(res, 400, {
        ok: false,
        error: "confirm must be RESET",
      });
    }
    await store.reset();
    return sendJson(res, 200, { ok: true, message: "system data reset" });
  }

  if (method === "GET" && pathname === "/api/simulate/success") {
    await writeSyntheticDownstreamLog(store, routeContext, req, "Simulated success processing", "info", null);
    return sendJson(res, 200, {
      ok: true,
      message: "success simulated",
      traceId: routeContext.traceContext.traceId,
    });
  }

  if (method === "GET" && pathname === "/api/simulate/fail") {
    const error = new Error("Cannot read properties of undefined (reading 'id') in order-handler");
    await writeSyntheticDownstreamLog(store, routeContext, req, "Simulated failure processing", "error", error);
    throw error;
  }

  return false;
}

export async function startServer({
  port = DEFAULT_PORT,
  host = DEFAULT_HOST,
  dataFilePath = DEFAULT_DATA_FILE,
  enableAutoAnalyze = process.env.AUTO_ANALYZE !== "0",
  analyzeIntervalMs = asInt(process.env.ANALYZE_INTERVAL_MS, 30000),
} = {}) {
  const store = new FileBackedStore(dataFilePath);
  await store.init();

  const scheduler = new AnalysisScheduler({
    store,
    intervalMs: analyzeIntervalMs,
    minErrorCount: 1,
    maxAnalyzeLogs: 20000,
  });

  if (enableAutoAnalyze) {
    scheduler.start();
  }

  const server = http.createServer(async (req, res) => {
    const startedAt = Date.now();
    const routeContext = createRequestContext(req);

    res.setHeader("x-trace-id", routeContext.traceContext.traceId);
    res.setHeader("x-span-id", routeContext.traceContext.spanId);

    const requestLog = createRequestLogger(store, req, routeContext);

    try {
      const served = await maybeServeStatic(new URL(req.url, "http://local").pathname, res);
      if (served) {
        return;
      }

      await requestLog("info", "request_start", {
        statusCode: null,
      });

      const result = await handleApiRoute(req, res, store, routeContext, scheduler);
      if (result === false) {
        sendJson(res, 404, {
          ok: false,
          error: "Not Found",
          traceId: routeContext.traceContext.traceId,
        });
      }

      await requestLog("info", "request_end", {
        statusCode: res.statusCode,
        meta: {
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      await requestLog("error", "request_error", {
        statusCode,
        error,
        meta: {
          durationMs: Date.now() - startedAt,
        },
      });

      sendJson(res, statusCode, {
        ok: false,
        traceId: routeContext.traceContext.traceId,
        error: error.message || "Internal Server Error",
      });
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));

  return {
    server,
    store,
    scheduler,
    port: server.address().port,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((err) => {
          scheduler.stop();
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }),
      ),
  };
}

async function main() {
  const instance = await startServer();
  // eslint-disable-next-line no-console
  console.log(`trace-log-platform running on http://${DEFAULT_HOST}:${instance.port}`);
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  });
}
