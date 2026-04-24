import { randomBytes } from "node:crypto";

function randomHex(bytes = 12) {
  return randomBytes(bytes).toString("hex");
}

function toErrorPayload(error) {
  if (!error) {
    return undefined;
  }
  return {
    name: error.name || "Error",
    message: error.message || String(error),
    stack: error.stack || "",
  };
}

function getHeaderValue(headers, name) {
  if (!headers || typeof headers !== "object") {
    return "";
  }
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name.toLowerCase());
  if (!key) {
    return "";
  }
  const value = headers[key];
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value === undefined || value === null ? "" : String(value);
}

export function createTraceContext({ traceId, parentSpanId = null, service = "backend-service", source = "backend" } = {}) {
  return {
    traceId: traceId || `tr_${randomHex(12)}`,
    spanId: `sp_${randomHex(8)}`,
    parentSpanId,
    service,
    source,
  };
}

export function childSpan(traceContext, service = traceContext?.service || "backend-service") {
  return createTraceContext({
    traceId: traceContext?.traceId,
    parentSpanId: traceContext?.spanId || null,
    service,
    source: traceContext?.source || "backend",
  });
}

export function extractTraceHeaders(headers = {}) {
  return {
    traceId: getHeaderValue(headers, "x-trace-id"),
    parentSpanId: getHeaderValue(headers, "x-parent-span-id"),
    traceparent: getHeaderValue(headers, "traceparent"),
  };
}

export function injectTraceHeaders(traceContext, additionalHeaders = {}) {
  const headers = { ...additionalHeaders };
  if (traceContext?.traceId) {
    headers["x-trace-id"] = traceContext.traceId;
  }
  if (traceContext?.spanId) {
    headers["x-parent-span-id"] = traceContext.spanId;
  }
  if (traceContext?.traceId && traceContext?.spanId) {
    headers.traceparent = `00-${traceContext.traceId}-${traceContext.spanId}-01`;
  }
  return headers;
}

export function createBackendLogClient({
  platformBaseUrl,
  serviceName,
  source = "backend",
  flushIntervalMs = 1000,
  batchSize = 30,
  fetchImpl = globalThis.fetch,
}) {
  if (!platformBaseUrl) {
    throw new Error("platformBaseUrl is required");
  }
  if (!serviceName) {
    throw new Error("serviceName is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required");
  }

  const normalizedBase = String(platformBaseUrl).replace(/\/$/, "");
  const queue = [];
  let timer = null;

  async function emitBatch(payloads) {
    const response = await fetchImpl(`${normalizedBase}/v1/logs/batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        source,
        logs: payloads,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to report logs: HTTP ${response.status}`);
    }
    return response.json().catch(() => null);
  }

  async function flush() {
    if (queue.length === 0) {
      return;
    }
    const batch = queue.splice(0, queue.length);
    await emitBatch(batch);
  }

  async function report({
    level = "info",
    message,
    traceContext,
    error,
    path,
    method,
    statusCode,
    meta,
    timestamp,
  }) {
    const context = traceContext || createTraceContext({ service: serviceName, source });
    const payload = {
      level,
      message: message || "",
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      service: serviceName,
      source,
      path: path || null,
      method: method || null,
      statusCode: statusCode || null,
      timestamp: timestamp || new Date().toISOString(),
      error: toErrorPayload(error),
      meta: meta || {},
      traceparent: `00-${context.traceId}-${context.spanId}-01`,
    };

    queue.push(payload);
    if (queue.length >= batchSize) {
      await flush();
    }
    return payload;
  }

  function startAutoFlush() {
    if (timer) {
      return;
    }
    timer = setInterval(() => {
      flush().catch(() => {
        // no-op
      });
    }, flushIntervalMs);
  }

  function stopAutoFlush() {
    if (!timer) {
      return;
    }
    clearInterval(timer);
    timer = null;
  }

  async function shutdown() {
    stopAutoFlush();
    await flush();
  }

  function createHttpRequestTracer(reqHeaders = {}) {
    const incoming = extractTraceHeaders(reqHeaders);
    const root = createTraceContext({
      traceId: incoming.traceId || undefined,
      parentSpanId: incoming.parentSpanId || null,
      service: serviceName,
      source,
    });
    return {
      traceContext: root,
      childSpan: () => childSpan(root, serviceName),
      outgoingHeaders: (additionalHeaders = {}) => injectTraceHeaders(root, additionalHeaders),
      reportStart: (meta = {}) =>
        report({
          level: "info",
          message: "request_start",
          traceContext: root,
          method: meta.method,
          path: meta.path,
          meta,
        }),
      reportError: (error, meta = {}) =>
        report({
          level: "error",
          message: "request_error",
          traceContext: root,
          error,
          method: meta.method,
          path: meta.path,
          statusCode: meta.statusCode,
          meta,
        }),
      reportEnd: (meta = {}) =>
        report({
          level: "info",
          message: "request_end",
          traceContext: root,
          method: meta.method,
          path: meta.path,
          statusCode: meta.statusCode,
          meta,
        }),
    };
  }

  startAutoFlush();

  return {
    report,
    flush,
    shutdown,
    createHttpRequestTracer,
    createTraceContext: (seed = {}) => createTraceContext({ ...seed, service: serviceName, source }),
    childSpan,
  };
}
