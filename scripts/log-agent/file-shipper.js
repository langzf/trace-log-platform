#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const PLATFORM_URL = String(process.env.PLATFORM_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const FILE_PATH = String(process.env.FILE_PATH || "").trim();
const SERVICE = String(process.env.SERVICE || process.env.SERVICE_NAME || "unknown-service").trim();
const SOURCE = String(process.env.SOURCE || "backend").trim() === "frontend" ? "frontend" : "backend";
const TRACE_PREFIX = String(process.env.TRACE_PREFIX || "shipper");
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 3000);
const MAX_READ_BYTES = Number(process.env.MAX_READ_BYTES || 1024 * 1024);
const MAX_LINES_PER_BATCH = Number(process.env.MAX_LINES_PER_BATCH || 300);
const CURSOR_FILE = String(
  process.env.CURSOR_FILE || path.join(process.cwd(), `.trace-log-shipper-${Buffer.from(FILE_PATH || "default").toString("hex")}.cursor`),
);

if (!FILE_PATH) {
  // eslint-disable-next-line no-console
  console.error("FILE_PATH is required");
  process.exit(1);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeLevel(line) {
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

async function readCursor() {
  try {
    const raw = await fs.readFile(CURSOR_FILE, "utf8");
    const cursor = Number(raw.trim());
    if (Number.isFinite(cursor) && cursor >= 0) {
      return cursor;
    }
    return 0;
  } catch (error) {
    if (error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}

async function writeCursor(cursor) {
  await fs.writeFile(CURSOR_FILE, String(Math.max(0, Number(cursor) || 0)));
}

async function readIncremental(filePath, cursor) {
  const fd = await fs.open(filePath, "r");
  try {
    const stat = await fd.stat();
    const start = cursor > stat.size ? 0 : cursor;
    const available = Math.max(0, stat.size - start);
    if (available <= 0) {
      return { cursorStart: start, cursorEnd: start, lines: [] };
    }
    const toRead = Math.min(available, Math.max(4096, MAX_READ_BYTES));
    const buffer = Buffer.alloc(toRead);
    const read = await fd.read(buffer, 0, toRead, start);
    const text = buffer.subarray(0, read.bytesRead).toString("utf8");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, Math.max(1, MAX_LINES_PER_BATCH));
    return {
      cursorStart: start,
      cursorEnd: start + read.bytesRead,
      lines,
    };
  } finally {
    await fd.close();
  }
}

function buildLogLinePayload(line, idx) {
  return {
    traceId: `${TRACE_PREFIX}_${Date.now()}`,
    level: normalizeLevel(line),
    message: line,
    service: SERVICE,
    timestamp: nowIso(),
    meta: {
      shipper: "file-shipper",
      sourceFile: FILE_PATH,
      lineNo: idx + 1,
    },
  };
}

async function pushBatch(lines) {
  if (lines.length === 0) {
    return { ok: true, skipped: true };
  }
  const logs = lines.map((line, idx) => buildLogLinePayload(line, idx));
  const response = await fetch(`${PLATFORM_URL}/v1/logs/batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-service-name": SERVICE,
    },
    body: JSON.stringify({
      source: SOURCE,
      logs,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `push failed: HTTP ${response.status}`);
  }
  return data;
}

async function tick() {
  const cursor = await readCursor();
  const chunk = await readIncremental(FILE_PATH, cursor);
  if (chunk.lines.length === 0) {
    await writeCursor(chunk.cursorEnd);
    return;
  }
  await pushBatch(chunk.lines);
  await writeCursor(chunk.cursorEnd);
  // eslint-disable-next-line no-console
  console.log(`[${nowIso()}] shipped ${chunk.lines.length} lines cursor=${chunk.cursorEnd}`);
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(`trace-log file shipper started: file=${FILE_PATH} platform=${PLATFORM_URL} service=${SERVICE}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[${nowIso()}] tick failed:`, error.message || error);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(1000, POLL_INTERVAL_MS)));
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
