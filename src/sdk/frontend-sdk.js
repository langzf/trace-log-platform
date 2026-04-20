(function (global) {
  function randomHex(bytes) {
    if (global.crypto && global.crypto.getRandomValues) {
      const array = new Uint8Array(bytes);
      global.crypto.getRandomValues(array);
      return Array.from(array)
        .map((v) => v.toString(16).padStart(2, "0"))
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

  function createClient(config) {
    const cfg = config || {};
    const platformBaseUrl = (cfg.platformBaseUrl || "").replace(/\/$/, "");
    const appName = cfg.appName || "frontend-app";
    const flushIntervalMs = typeof cfg.flushIntervalMs === "number" ? cfg.flushIntervalMs : 2000;
    const batchSize = typeof cfg.batchSize === "number" ? cfg.batchSize : 20;
    const autoCaptureErrors = cfg.autoCaptureErrors !== false;

    const state = {
      queue: [],
      timer: null,
      shuttingDown: false,
    };

    function startTrace(meta) {
      return {
        traceId: "tr_" + randomHex(12),
        spanId: "sp_" + randomHex(8),
        parentSpanId: null,
        meta: meta || {},
      };
    }

    function childSpan(traceContext, meta) {
      return {
        traceId: traceContext.traceId,
        spanId: "sp_" + randomHex(8),
        parentSpanId: traceContext.spanId,
        meta: {
          ...(traceContext.meta || {}),
          ...(meta || {}),
        },
      };
    }

    function queueLog(entry) {
      state.queue.push(entry);
      if (state.queue.length >= batchSize) {
        return flush();
      }
      return Promise.resolve();
    }

    async function emitSingle(payload) {
      const response = await fetch(platformBaseUrl + "/v1/logs/frontend", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-trace-id": payload.traceId || "",
          "x-parent-span-id": payload.parentSpanId || "",
          "x-client-app": appName,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("frontend log upload failed: " + response.status);
      }

      return response.json();
    }

    async function emitBatch(payloads) {
      if (payloads.length === 1) {
        return emitSingle(payloads[0]);
      }

      const response = await fetch(platformBaseUrl + "/v1/logs/batch", {
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
        throw new Error("frontend batch upload failed: " + response.status);
      }

      return response.json();
    }

    async function flush() {
      if (state.queue.length === 0) {
        return;
      }
      const batch = state.queue.splice(0, state.queue.length);
      await emitBatch(batch);
    }

    function flushBeacon() {
      if (!global.navigator || !global.navigator.sendBeacon || state.queue.length === 0) {
        return;
      }

      const payload = JSON.stringify({
        source: "frontend",
        logs: state.queue.splice(0, state.queue.length),
      });
      const blob = new Blob([payload], { type: "application/json" });
      global.navigator.sendBeacon(platformBaseUrl + "/v1/logs/batch", blob);
    }

    async function log(level, message, options) {
      const opts = options || {};
      const context = opts.traceContext || startTrace();
      const payload = {
        level: level || "info",
        message: message || "",
        traceId: context.traceId,
        spanId: context.spanId,
        parentSpanId: context.parentSpanId || null,
        source: "frontend",
        service: appName,
        path: opts.path || (global.location && global.location.pathname) || "/",
        method: opts.method,
        statusCode: opts.statusCode,
        error: toErrorPayload(opts.error),
        timestamp: new Date().toISOString(),
        meta: {
          ...(context.meta || {}),
          ...(opts.meta || {}),
        },
      };
      return queueLog(payload);
    }

    async function tracedFetch(url, fetchOptions, traceContext) {
      const options = fetchOptions || {};
      const context = traceContext || startTrace();
      const requestSpan = childSpan(context, { op: "http_request" });
      const requestUrl = toUrl(url);
      const headers = new Headers(options.headers || {});
      headers.set("x-trace-id", context.traceId);
      headers.set("x-parent-span-id", requestSpan.spanId);
      headers.set("x-client-app", appName);

      await log("info", "frontend request started", {
        traceContext: requestSpan,
        path: requestUrl,
        method: options.method || "GET",
        meta: { phase: "request_start" },
      });

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        await log(response.ok ? "info" : "warn", "frontend request finished", {
          traceContext: requestSpan,
          path: requestUrl,
          method: options.method || "GET",
          statusCode: response.status,
          meta: { phase: "request_end" },
        });

        return {
          response: response,
          traceContext: context,
        };
      } catch (error) {
        await log("error", "frontend request failed", {
          traceContext: requestSpan,
          path: requestUrl,
          method: options.method || "GET",
          error,
          meta: { phase: "request_error" },
        });
        throw error;
      }
    }

    function startAutoFlush() {
      if (state.timer) {
        return;
      }
      state.timer = setInterval(() => {
        flush().catch(function () {
          // no-op
        });
      }, flushIntervalMs);
    }

    function stopAutoFlush() {
      if (!state.timer) {
        return;
      }
      clearInterval(state.timer);
      state.timer = null;
    }

    function bindGlobalErrors() {
      if (!autoCaptureErrors || !global.addEventListener) {
        return;
      }

      global.addEventListener("error", function (event) {
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
        }).catch(function () {
          // no-op
        });
      });

      global.addEventListener("unhandledrejection", function (event) {
        log("error", "window.unhandledrejection", {
          error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        }).catch(function () {
          // no-op
        });
      });
    }

    function shutdown() {
      state.shuttingDown = true;
      stopAutoFlush();
      flushBeacon();
      return flush();
    }

    startAutoFlush();
    bindGlobalErrors();

    if (global.addEventListener) {
      global.addEventListener("beforeunload", function () {
        flushBeacon();
      });
      global.addEventListener("visibilitychange", function () {
        if (global.document && global.document.visibilityState === "hidden") {
          flushBeacon();
        }
      });
    }

    return {
      startTrace: startTrace,
      childSpan: childSpan,
      log: log,
      flush: flush,
      shutdown: shutdown,
      tracedFetch: tracedFetch,
    };
  }

  global.TraceLogSDK = {
    createClient: createClient,
  };
})(typeof window === "undefined" ? globalThis : window);
