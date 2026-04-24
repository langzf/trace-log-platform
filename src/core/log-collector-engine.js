import { promises as fs } from "node:fs";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

import { generateId, nowIso } from "./ids.js";
import { createTraceContext } from "./trace.js";

const exec = promisify(execCb);

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function asInt(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

function safeError(rawError) {
  if (!rawError) {
    return null;
  }
  return {
    name: rawError.name || "Error",
    message: rawError.message || String(rawError),
    stack: rawError.stack || "",
  };
}

function normalizeLevel(input) {
  const value = String(input || "info").trim().toLowerCase();
  if (["fatal", "error", "warn", "warning", "info", "debug", "trace"].includes(value)) {
    if (value === "warning") {
      return "warn";
    }
    if (value === "fatal") {
      return "error";
    }
    return value;
  }
  return "info";
}

function detectLevelFromText(line) {
  const text = String(line || "").toLowerCase();
  if (/(fatal|panic|uncaught|exception|error)/.test(text)) {
    return "error";
  }
  if (/(warn|degraded|slow)/.test(text)) {
    return "warn";
  }
  if (/(debug|trace)/.test(text)) {
    return "debug";
  }
  return "info";
}

function detectTraceId(line) {
  const text = String(line || "");
  const match =
    text.match(/\btrace(?:Id|_id|ID)?[=: ]([a-zA-Z0-9_-]{8,})/) ||
    text.match(/\bx-request-id[=: ]([a-zA-Z0-9_-]{8,})/i) ||
    text.match(/\brequestId[=: ]([a-zA-Z0-9_-]{8,})/i);
  return match ? match[1] : null;
}

function buildRegexList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  const list = [];
  for (const raw of values) {
    if (!raw) {
      continue;
    }
    try {
      list.push(new RegExp(String(raw), "i"));
    } catch {
      // ignore invalid regex
    }
  }
  return list;
}

function shouldKeepLine(line, includePatterns, excludePatterns) {
  if (includePatterns.length > 0 && !includePatterns.some((re) => re.test(line))) {
    return false;
  }
  if (excludePatterns.some((re) => re.test(line))) {
    return false;
  }
  return true;
}

function parseNginxLine(line) {
  const match = line.match(
    /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+([^"]*?)\s*(?:HTTP\/[\d.]+)?"\s+(\d{3})\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"/,
  );
  if (!match) {
    return null;
  }
  const statusCode = Number(match[5]);
  const message = `${match[3]} ${match[4]} -> ${statusCode}`;
  let level = "info";
  if (statusCode >= 500) {
    level = "error";
  } else if (statusCode >= 400) {
    level = "warn";
  }
  return {
    timestamp: null,
    level,
    message,
    path: match[4] || null,
    method: match[3] || null,
    statusCode,
    meta: {
      clientIp: match[1],
      bytesSent: match[6] === "-" ? null : Number(match[6]),
      referer: match[7] || null,
      userAgent: match[8] || null,
      rawTimeLocal: match[2],
    },
  };
}

export function parseLine({ line, profile, fallbackTraceId }) {
  const parseConfig = profile.parse || {};
  const format = String(parseConfig.format || "auto").trim().toLowerCase();
  const levelField = String(parseConfig.levelField || "level");
  const messageField = String(parseConfig.messageField || "message");
  const timestampField = String(parseConfig.timestampField || "timestamp");
  const traceIdField = String(parseConfig.traceIdField || "traceId");

  const staticMeta =
    profile.options && profile.options.staticMeta && typeof profile.options.staticMeta === "object"
      ? profile.options.staticMeta
      : {};

  const buildLog = (payload = {}) => ({
    id: generateId("log_", 8),
    timestamp: payload.timestamp || nowIso(),
    source: "backend",
    service: profile.service,
    traceId: payload.traceId || fallbackTraceId,
    spanId: generateId("sp_", 8),
    parentSpanId: null,
    level: normalizeLevel(payload.level),
    message: String(payload.message || line),
    path: payload.path || null,
    method: payload.method || null,
    statusCode: Number.isFinite(Number(payload.statusCode)) ? Number(payload.statusCode) : null,
    error: payload.error ? safeError(payload.error) : null,
    meta: {
      projectKey: profile.projectKey,
      collectorKey: profile.collectorKey,
      collectorMode: profile.mode,
      ...(payload.meta && typeof payload.meta === "object" ? payload.meta : {}),
      ...staticMeta,
    },
  });

  if (format === "nginx_access") {
    const parsed = parseNginxLine(line);
    if (parsed) {
      return buildLog(parsed);
    }
    return buildLog({
      level: detectLevelFromText(line),
      message: line,
      traceId: detectTraceId(line) || fallbackTraceId,
    });
  }

  if (format === "json" || format === "auto") {
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const traceId =
          obj[traceIdField] ||
          obj.trace_id ||
          obj.traceID ||
          obj.request_id ||
          obj.requestId ||
          detectTraceId(line) ||
          fallbackTraceId;
        const payload = {
          timestamp: obj[timestampField] || obj.time || obj["@timestamp"] || null,
          level: obj[levelField] || obj.severity || detectLevelFromText(line),
          message: obj[messageField] || obj.msg || line,
          path: obj.path || obj.url || null,
          method: obj.method || null,
          statusCode: obj.statusCode || obj.status || null,
          traceId,
          error:
            obj.error && typeof obj.error === "object"
              ? obj.error
              : obj.error
                ? { name: "Error", message: String(obj.error), stack: "" }
                : null,
          meta: {
            parsedFrom: "json",
          },
        };
        return buildLog(payload);
      }
    } catch {
      // fallback to plain mode
    }
  }

  return buildLog({
    level: detectLevelFromText(line),
    message: line,
    traceId: detectTraceId(line) || fallbackTraceId,
  });
}

async function collectFromLocalFile(profile) {
  const source = profile.source || {};
  const state = profile.state || {};
  const filePath = String(source.filePath || "").trim();
  if (!filePath) {
    throw new Error("source.filePath is required for local_file mode");
  }

  const fd = await fs.open(filePath, "r");
  try {
    const stat = await fd.stat();
    const fromEnd = Boolean(source.fromEndOnFirstRun ?? source.fromEnd ?? false);
    const maxReadBytes = Math.max(4 * 1024, asInt(source.maxReadBytes, 1024 * 1024));
    const cursorBefore = Number.isFinite(Number(state.cursor)) ? Number(state.cursor) : 0;
    let cursorStart = cursorBefore;

    if (cursorStart <= 0 && fromEnd) {
      return {
        lines: [],
        cursorStart: stat.size,
        cursorEnd: stat.size,
        scannedCount: 0,
        note: "first run from end, skipped historical lines",
        statePatch: {
          cursor: stat.size,
        },
      };
    }

    if (cursorStart > stat.size) {
      cursorStart = 0;
    }

    const available = Math.max(0, stat.size - cursorStart);
    if (available <= 0) {
      return {
        lines: [],
        cursorStart,
        cursorEnd: cursorStart,
        scannedCount: 0,
        statePatch: {
          cursor: cursorStart,
        },
      };
    }

    const toRead = Math.min(available, maxReadBytes);
    const buffer = Buffer.alloc(toRead);
    const readResult = await fd.read(buffer, 0, toRead, cursorStart);
    const text = buffer.subarray(0, readResult.bytesRead).toString(source.encoding || "utf8");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      lines,
      cursorStart,
      cursorEnd: cursorStart + readResult.bytesRead,
      scannedCount: lines.length,
      note: available > maxReadBytes ? "read window truncated by maxReadBytes" : "",
      statePatch: {
        cursor: cursorStart + readResult.bytesRead,
      },
    };
  } finally {
    await fd.close();
  }
}

async function collectFromCommand(profile) {
  const source = profile.source || {};
  const command = String(source.command || "").trim();
  if (!command) {
    throw new Error("source.command is required for command_pull mode");
  }
  const timeoutMs = Math.max(1000, asInt(source.timeoutMs, 15000));
  const maxBuffer = Math.max(64 * 1024, asInt(source.maxBuffer, 1024 * 1024));
  const { stdout } = await exec(command, {
    shell: "/bin/bash",
    timeout: timeoutMs,
    maxBuffer,
  });
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    lines,
    cursorStart: null,
    cursorEnd: null,
    scannedCount: lines.length,
    statePatch: {},
  };
}

async function collectFromJournald(profile) {
  const source = profile.source || {};
  const state = profile.state || {};
  const unit = String(source.unit || "").trim();
  const explicitCommand = String(source.command || "").trim();
  if (!unit && !explicitCommand) {
    throw new Error("source.unit or source.command is required for journald mode");
  }

  const timeoutMs = Math.max(1000, asInt(source.timeoutMs, 15000));
  const maxBuffer = Math.max(64 * 1024, asInt(source.maxBuffer, 1024 * 1024));
  const linesLimit = Math.max(50, asInt(source.lines, 500));
  const since = String(state.journaldCursor || source.since || "5 minutes ago").trim();
  const command =
    explicitCommand ||
    `journalctl -u ${shellQuote(unit)} --since ${shellQuote(since)} -n ${linesLimit} -o json --no-pager`;

  const { stdout } = await exec(command, {
    shell: "/bin/bash",
    timeout: timeoutMs,
    maxBuffer,
  });
  const rawLines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let maxRealtimeUsec = 0;
  for (const line of rawLines) {
    try {
      const obj = JSON.parse(line);
      const usec = Number(obj.__REALTIME_TIMESTAMP || 0);
      if (Number.isFinite(usec) && usec > maxRealtimeUsec) {
        maxRealtimeUsec = usec;
      }
    } catch {
      // ignore malformed line
    }
  }

  const statePatch = {};
  if (maxRealtimeUsec > 0) {
    statePatch.journaldCursor = new Date(Math.floor(maxRealtimeUsec / 1000)).toISOString();
    statePatch.journaldRealtimeUsec = maxRealtimeUsec;
  }

  return {
    lines: rawLines,
    cursorStart: state.journaldRealtimeUsec || null,
    cursorEnd: maxRealtimeUsec > 0 ? maxRealtimeUsec : state.journaldRealtimeUsec || null,
    scannedCount: rawLines.length,
    statePatch,
  };
}

async function collectFromOssPull(profile) {
  const source = profile.source || {};
  const state = profile.state || {};
  const objectUrl = String(source.objectUrl || "").trim();
  if (!objectUrl) {
    throw new Error("source.objectUrl is required for oss_pull mode");
  }

  const cursor = Number.isFinite(Number(state.cursor)) ? Number(state.cursor) : 0;
  const maxReadBytes = Math.max(4096, asInt(source.maxReadBytes, 1024 * 1024));
  const timeoutMs = Math.max(1000, asInt(source.timeoutMs, 20000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (source.headers && typeof source.headers === "object" && !Array.isArray(source.headers)) {
      for (const [key, value] of Object.entries(source.headers)) {
        headers[key] = String(value);
      }
    }
    if (cursor > 0) {
      headers.range = `bytes=${cursor}-${cursor + maxReadBytes - 1}`;
    } else if (maxReadBytes > 0) {
      headers.range = `bytes=0-${maxReadBytes - 1}`;
    }

    const response = await fetch(objectUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (response.status === 416) {
      return {
        lines: [],
        cursorStart: cursor,
        cursorEnd: cursor,
        scannedCount: 0,
        statePatch: {
          cursor,
        },
      };
    }
    if (!response.ok) {
      throw new Error(`oss_pull fetch failed: HTTP ${response.status}`);
    }

    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const text = buffer.toString(source.encoding || "utf8");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let cursorEnd = cursor + buffer.byteLength;
    const contentRange = response.headers.get("content-range");
    if (contentRange && /bytes\s+(\d+)-(\d+)\//i.test(contentRange)) {
      const match = contentRange.match(/bytes\s+(\d+)-(\d+)\//i);
      const rangeStart = Number(match?.[1] || cursor);
      const rangeEnd = Number(match?.[2] || rangeStart - 1);
      cursorEnd = rangeEnd >= rangeStart ? rangeEnd + 1 : rangeStart;
    }
    if (response.status === 200 && cursor > 0) {
      // server ignored Range and returned full object; keep only appended segment
      if (buffer.byteLength <= cursor) {
        return {
          lines: [],
          cursorStart: cursor,
          cursorEnd: cursor,
          scannedCount: 0,
          statePatch: {
            cursor,
            etag: response.headers.get("etag") || null,
          },
        };
      }
      const tailBuffer = buffer.subarray(cursor);
      const tailLines = tailBuffer
        .toString(source.encoding || "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      return {
        lines: tailLines,
        cursorStart: cursor,
        cursorEnd: buffer.byteLength,
        scannedCount: tailLines.length,
        statePatch: {
          cursor: buffer.byteLength,
          etag: response.headers.get("etag") || null,
        },
      };
    }

    return {
      lines,
      cursorStart: cursor,
      cursorEnd,
      scannedCount: lines.length,
      statePatch: {
        cursor: cursorEnd,
        etag: response.headers.get("etag") || null,
      },
    };
  } finally {
    clearTimeout(timer);
  };
}

export class LogCollectorEngine {
  constructor({ store, tickIntervalMs = 5000, log = null } = {}) {
    this.store = store;
    this.tickIntervalMs = tickIntervalMs;
    this.log = typeof log === "function" ? log : null;
    this.timer = null;
    this.runningCollectors = new Set();
    this.runningTick = false;
    this.lastTickAt = null;
  }

  snapshot() {
    return {
      running: Boolean(this.timer),
      tickIntervalMs: this.tickIntervalMs,
      runningCollectors: [...this.runningCollectors],
      lastTickAt: this.lastTickAt,
    };
  }

  start() {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        if (this.log) {
          this.log("collector.tick.error", { error: safeError(error) });
        }
      });
    }, this.tickIntervalMs);
  }

  stop() {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.runningTick) {
      return;
    }
    this.runningTick = true;
    this.lastTickAt = nowIso();
    try {
      const collectors = this.store.listLogCollectors({
        enabled: true,
        limit: 500,
      });
      const now = Date.now();
      for (const collector of collectors) {
        const lastRunAt = collector.state?.lastRunAt ? new Date(collector.state.lastRunAt).getTime() : 0;
        const pollIntervalSec = Math.max(10, asInt(collector.pollIntervalSec, 30));
        const due = !lastRunAt || now - lastRunAt >= pollIntervalSec * 1000;
        if (!due) {
          continue;
        }
        await this.runCollector(collector.collectorKey, { trigger: "schedule" });
      }
    } finally {
      this.runningTick = false;
    }
  }

  async runCollector(collectorKey, { trigger = "manual" } = {}) {
    if (this.runningCollectors.has(collectorKey)) {
      return {
        ok: false,
        skipped: true,
        reason: "collector is already running",
        collectorKey,
      };
    }

    const profile = this.store.getLogCollector(collectorKey);
    if (!profile) {
      const error = new Error("collector not found");
      error.statusCode = 404;
      throw error;
    }
    if (!profile.enabled) {
      const error = new Error("collector is disabled");
      error.statusCode = 409;
      throw error;
    }

    this.runningCollectors.add(collectorKey);
    const startedAt = nowIso();
    const runId = generateId("collect_", 8);
    const fallbackTraceId = createTraceContext({
      service: profile.service,
      source: "backend",
    }).traceId;

    let cursorStart = Number.isFinite(Number(profile.state?.cursor)) ? Number(profile.state.cursor) : null;
    let cursorEnd = cursorStart;
    let scannedCount = 0;
    let ingestedCount = 0;
    let note = "";
    let statePatch = {};

    try {
      let collectResult;
      if (profile.mode === "command_pull") {
        collectResult = await collectFromCommand(profile);
      } else if (profile.mode === "journald") {
        collectResult = await collectFromJournald(profile);
      } else if (profile.mode === "oss_pull") {
        collectResult = await collectFromOssPull(profile);
      } else if (profile.mode === "syslog_http") {
        const modeError = new Error("syslog_http mode is push-based and does not support run");
        modeError.statusCode = 409;
        throw modeError;
      } else {
        collectResult = await collectFromLocalFile(profile);
      }

      const includePatterns = buildRegexList(profile.options?.includePatterns);
      const excludePatterns = buildRegexList(profile.options?.excludePatterns);
      const maxLinesPerRun = Math.max(1, asInt(profile.options?.maxLinesPerRun, 500));

      cursorStart = collectResult.cursorStart;
      cursorEnd = collectResult.cursorEnd;
      scannedCount = collectResult.scannedCount;
      note = collectResult.note || "";
      statePatch = collectResult.statePatch || {};

      const logs = [];
      for (const line of collectResult.lines) {
        if (!shouldKeepLine(line, includePatterns, excludePatterns)) {
          continue;
        }
        logs.push(
          parseLine({
            line,
            profile,
            fallbackTraceId,
          }),
        );
        if (logs.length >= maxLinesPerRun) {
          break;
        }
      }

      if (logs.length > 0) {
        await this.store.addLogs(logs);
      }
      ingestedCount = logs.length;

      const finishedAt = nowIso();
      await this.store.patchLogCollectorState(collectorKey, {
        ...statePatch,
        lastRunAt: finishedAt,
        lastStatus: "success",
        lastError: null,
        lastIngestedCount: ingestedCount,
        lastScannedCount: scannedCount,
      });
      const run = await this.store.addCollectorRun({
        id: runId,
        collectorKey,
        trigger,
        status: "success",
        startedAt,
        finishedAt,
        ingestedCount,
        scannedCount,
        cursorStart,
        cursorEnd,
        message: note || `ingested ${ingestedCount}/${scannedCount} lines`,
        metadata: {
          mode: profile.mode,
          projectKey: profile.projectKey,
          service: profile.service,
        },
      });

      return {
        ok: true,
        collectorKey,
        run,
      };
    } catch (error) {
      const finishedAt = nowIso();
      await this.store.patchLogCollectorState(collectorKey, {
        ...statePatch,
        lastRunAt: finishedAt,
        lastStatus: "failed",
        lastError: safeError(error),
        lastIngestedCount: ingestedCount,
        lastScannedCount: scannedCount,
      });
      const run = await this.store.addCollectorRun({
        id: runId,
        collectorKey,
        trigger,
        status: "failed",
        startedAt,
        finishedAt,
        ingestedCount,
        scannedCount,
        cursorStart,
        cursorEnd,
        message: error.message || "collector execution failed",
        error: safeError(error),
        metadata: {
          mode: profile.mode,
          projectKey: profile.projectKey,
          service: profile.service,
        },
      });
      if (error && !error.statusCode) {
        error.statusCode = 500;
      }
      error.run = run;
      throw error;
    } finally {
      this.runningCollectors.delete(collectorKey);
    }
  }
}
