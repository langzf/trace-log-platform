import { generateId } from "./ids.js";

function parseTraceParent(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parts = value.trim().split("-");
  if (parts.length !== 4) {
    return null;
  }

  const [, traceId, parentSpanId] = parts;
  if (!traceId || !parentSpanId) {
    return null;
  }

  return {
    traceId: `tr_${traceId}`,
    parentSpanId: `sp_${parentSpanId.slice(0, 16)}`,
  };
}

function trimPrefix(value, prefix) {
  if (!value) {
    return value;
  }
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

export function toTraceParent(traceContext) {
  const traceId = trimPrefix(traceContext.traceId || generateId("tr_", 12), "tr_").padEnd(32, "0").slice(0, 32);
  const spanId = trimPrefix(traceContext.spanId || generateId("sp_", 8), "sp_").padEnd(16, "0").slice(0, 16);
  return `00-${traceId}-${spanId}-01`;
}

export function createTraceContext({
  traceId,
  parentSpanId,
  service = "unknown",
  source = "backend",
} = {}) {
  return {
    traceId: traceId || generateId("tr_", 12),
    parentSpanId: parentSpanId || null,
    spanId: generateId("sp_", 8),
    service,
    source,
  };
}

export function childSpan(traceContext, service = traceContext.service) {
  return {
    traceId: traceContext.traceId,
    parentSpanId: traceContext.spanId,
    spanId: generateId("sp_", 8),
    service,
    source: traceContext.source,
  };
}

export function extractTraceHeaders(headers) {
  const get = (key) => {
    if (!headers) {
      return null;
    }
    if (typeof headers.get === "function") {
      return headers.get(key);
    }
    const normalized = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
    return normalized[key.toLowerCase()] || null;
  };

  const traceparent = get("traceparent");
  const parsed = parseTraceParent(traceparent);

  return {
    traceId: get("x-trace-id") || parsed?.traceId || null,
    parentSpanId: get("x-parent-span-id") || parsed?.parentSpanId || null,
    clientApp: get("x-client-app"),
    traceparent,
  };
}

export function injectTraceHeaders(traceContext, headers = {}) {
  return {
    ...headers,
    "x-trace-id": traceContext.traceId,
    "x-parent-span-id": traceContext.spanId,
    traceparent: toTraceParent(traceContext),
  };
}
