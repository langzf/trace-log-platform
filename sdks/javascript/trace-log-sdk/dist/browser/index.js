function randomHex(bytes) {
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    const values = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(values);
    return Array.from(values)
      .map((item) => item.toString(16).padStart(2, "0"))
      .join("");
  }
  let output = "";
  for (let i = 0; i < bytes; i += 1) {
    output += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  }
  return output;
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

function toUrl(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input && typeof input.url === "string") {
    return input.url;
  }
  return String(input);
}

export function createClient(config = {}) {
  const platformBaseUrl = String(config.platformBaseUrl || "").replace(/\/$/, "");
  const appName = String(config.appName || "frontend-app");
  const flushIntervalMs = Number.isFinite(Number(config.flushIntervalMs)) ? Number(config.flushIntervalMs) : 2000;
  const batchSize = Number.isFinite(Number(config.batchSize)) ? Number(config.batchSize) : 20;
  const autoCaptureErrors = config.autoCaptureErrors !== false;

  if (!platformBaseUrl) {
    throw new Error("platformBaseUrl is required");
  }

  const queue = [];
  let timer = null;

  function startTrace(meta = {}) {
    return {
      traceId: `tr_${randomHex(12)}`,
      spanId: `sp_${randomHex(8)}`,
      parentSpanId: null,
      meta,
    };
  }

  function childSpan(traceContext, meta = {}) {
    return {
      traceId: traceContext.traceId,
      spanId: `sp_${randomHex(8)}`,
      parentSpanId: traceContext.spanId,
      meta: {
        ...(traceContext.meta || {}),
        ...meta,
      },
    };
  }

  async function emitBatch(payloads) {
    const response = await fetch(`${platformBaseUrl}/v1/logs/batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-client-app": appName,
      },
      body: JSON.stringify({
        source: "frontend",
        logs: payloads,
      }),
    });
    if (!response.ok) {
      throw new Error(`frontend batch upload failed: ${response.status}`);
    }
    return response.json().catch(() => null);
  }

  async function flush() {
    if (queue.length === 0) {
      return;
    }
    const payloads = queue.splice(0, queue.length);
    await emitBatch(payloads);
  }

  function queueLog(payload) {
    queue.push(payload);
    if (queue.length >= batchSize) {
      return flush();
    }
    return Promise.resolve();
  }

  async function log(level, message, options = {}) {
    const traceContext = options.traceContext || startTrace();
    const payload = {
      level: level || "info",
      message: message || "",
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      parentSpanId: traceContext.parentSpanId || null,
      source: "frontend",
      service: appName,
      path: options.path || (globalThis.location && globalThis.location.pathname) || "/",
      method: options.method,
      statusCode: options.statusCode,
      error: toErrorPayload(options.error),
      timestamp: new Date().toISOString(),
      meta: {
        ...(traceContext.meta || {}),
        ...(options.meta || {}),
      },
    };
    return queueLog(payload);
  }

  async function tracedFetch(url, fetchOptions = {}, traceContext = null) {
    const root = traceContext || startTrace();
    const requestSpan = childSpan(root, { op: "http_request" });
    const headers = new Headers(fetchOptions.headers || {});
    headers.set("x-trace-id", root.traceId);
    headers.set("x-parent-span-id", requestSpan.spanId);
    headers.set("x-client-app", appName);

    const requestUrl = toUrl(url);
    await log("info", "frontend request started", {
      traceContext: requestSpan,
      path: requestUrl,
      method: fetchOptions.method || "GET",
      meta: { phase: "request_start" },
    });

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
      await log(response.ok ? "info" : "warn", "frontend request finished", {
        traceContext: requestSpan,
        path: requestUrl,
        method: fetchOptions.method || "GET",
        statusCode: response.status,
        meta: { phase: "request_end" },
      });
      return { response, traceContext: root };
    } catch (error) {
      await log("error", "frontend request failed", {
        traceContext: requestSpan,
        path: requestUrl,
        method: fetchOptions.method || "GET",
        error,
        meta: { phase: "request_error" },
      });
      throw error;
    }
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

  function bindGlobalErrors() {
    if (!autoCaptureErrors || !globalThis.addEventListener) {
      return;
    }

    globalThis.addEventListener("error", (event) => {
      if (!event || !event.error) {
        return;
      }
      log("error", "window.error", {
        error: event.error,
        meta: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      }).catch(() => {
        // no-op
      });
    });

    globalThis.addEventListener("unhandledrejection", (event) => {
      log("error", "window.unhandledrejection", {
        error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      }).catch(() => {
        // no-op
      });
    });
  }

  async function shutdown() {
    stopAutoFlush();
    await flush();
  }

  startAutoFlush();
  bindGlobalErrors();

  return {
    startTrace,
    childSpan,
    log,
    tracedFetch,
    flush,
    shutdown,
  };
}

export default {
  createClient,
};
