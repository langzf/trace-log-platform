import { childSpan, createTraceContext, extractTraceHeaders, injectTraceHeaders } from "../core/trace.js";

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

export function extractIncomingTrace(headers, serviceName = "backend-service") {
  const extracted = extractTraceHeaders(headers);
  return createTraceContext({
    traceId: extracted.traceId || undefined,
    parentSpanId: extracted.parentSpanId || undefined,
    service: serviceName,
    source: "backend",
  });
}

export function createOutgoingHeaders(traceContext, additionalHeaders = {}) {
  return injectTraceHeaders(traceContext, additionalHeaders);
}

export function createBackendLogClient({ platformBaseUrl, serviceName, flushIntervalMs = 1000, batchSize = 30 }) {
  if (!platformBaseUrl) {
    throw new Error("platformBaseUrl is required");
  }

  const normalizedBase = platformBaseUrl.replace(/\/$/, "");
  const queue = [];
  let timer = null;

  async function emitSingle(payload) {
    const response = await fetch(`${normalizedBase}/v1/logs/backend`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-trace-id": payload.traceId,
        "x-parent-span-id": payload.parentSpanId || "",
        traceparent: payload.traceparent || "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to report log: ${response.status}`);
    }

    return response.json();
  }

  async function emitBatch(payloads) {
    if (payloads.length === 1) {
      return emitSingle(payloads[0]);
    }

    const response = await fetch(`${normalizedBase}/v1/logs/batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        source: "backend",
        logs: payloads,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to batch report logs: ${response.status}`);
    }

    return response.json();
  }

  async function flush() {
    if (queue.length === 0) {
      return;
    }

    const payloads = queue.splice(0, queue.length);
    await emitBatch(payloads);
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
    const context = traceContext || createTraceContext({ service: serviceName || "unknown-service" });

    const payload = {
      level,
      message,
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      service: serviceName || context.service || "unknown-service",
      source: "backend",
      path,
      method,
      statusCode,
      timestamp: timestamp || new Date().toISOString(),
      error: toErrorPayload(error),
      meta,
      traceparent: createOutgoingHeaders(context).traceparent,
    };

    queue.push(payload);
    if (queue.length >= batchSize) {
      await flush();
    }

    return { ok: true };
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

  function createHttpRequestTracer(reqHeaders) {
    const rootTrace = extractIncomingTrace(reqHeaders, serviceName || "unknown-service");

    return {
      traceContext: rootTrace,
      childSpan: (spanService) => childSpan(rootTrace, spanService || serviceName),
      outgoingHeaders: () => createOutgoingHeaders(rootTrace),
      reportStart: (meta) =>
        report({
          level: "info",
          message: "request_start",
          traceContext: rootTrace,
          method: meta?.method,
          path: meta?.path,
          meta,
        }),
      reportError: (error, meta) =>
        report({
          level: "error",
          message: "request_error",
          traceContext: rootTrace,
          error,
          method: meta?.method,
          path: meta?.path,
          statusCode: meta?.statusCode,
          meta,
        }),
      reportEnd: (meta) =>
        report({
          level: "info",
          message: "request_end",
          traceContext: rootTrace,
          method: meta?.method,
          path: meta?.path,
          statusCode: meta?.statusCode,
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
  };
}
