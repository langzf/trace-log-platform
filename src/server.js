import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { analyzeExceptionLogs } from "./core/analyzer.js";
import { AnalysisScheduler } from "./core/analysis-scheduler.js";
import { buildEventEnvelope, validateEventEnvelope, validateTopic } from "./core/event-envelope.js";
import { generateId, nowIso } from "./core/ids.js";
import {
  checkOpenClawEndpointHealth,
  probeOpenClaw,
  runOpenClawInstall,
  syncExecutorToRepairReceiver,
} from "./core/openclaw-manager.js";
import { LogCollectorEngine } from "./core/log-collector-engine.js";
import { SqliteAuditSink } from "./core/sqlite-audit-sink.js";
import { FileBackedStore } from "./core/storage.js";
import { InMemoryTopicQueue } from "./core/topic-queue.js";
import { childSpan, createTraceContext, extractTraceHeaders } from "./core/trace.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const DEFAULT_HOST = process.env.HOST || "127.0.0.1";
const DEFAULT_DATA_FILE = path.join(__dirname, "..", "data", "platform-store.json");
const DEFAULT_AUDIT_DB_FILE = path.join(__dirname, "..", "data", "platform.db");
const FRONTEND_SDK_FILE = path.join(__dirname, "sdk", "frontend-sdk.js");
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DEFAULT_PACKAGE_CATALOG_FILE = path.join(PUBLIC_DIR, "packages", "index.json");
const DEFAULT_QUEUE_MAX_ATTEMPTS = asInt(process.env.QUEUE_MAX_ATTEMPTS, 3);
const DEFAULT_OPENCLAW_INSTALL_SCRIPT =
  process.env.OPENCLAW_INSTALL_SCRIPT || path.join(__dirname, "..", "scripts", "openclaw", "install_openclaw.sh");
const DEFAULT_OPENCLAW_INSTALL_METHOD = process.env.OPENCLAW_INSTALL_METHOD || "auto";
const DEFAULT_OPENCLAW_TARGET_VERSION = process.env.OPENCLAW_TARGET_VERSION || "";
const DEFAULT_OPENCLAW_BINARY_URL = process.env.OPENCLAW_BINARY_URL || "";
const DEFAULT_OPENCLAW_BINARY_SHA256 = process.env.OPENCLAW_BINARY_SHA256 || "";
const DEFAULT_OPENCLAW_BOOTSTRAP_URL = process.env.OPENCLAW_BOOTSTRAP_URL || "";
const DEFAULT_OPENCLAW_INSTALL_DIR = process.env.OPENCLAW_INSTALL_DIR || "";
const DEFAULT_OPENCLAW_EXPECT_HEALTH = process.env.OPENCLAW_EXPECT_HEALTH === "1";
const DEFAULT_OPENCLAW_POST_INSTALL_COMMAND = process.env.OPENCLAW_POST_INSTALL_COMMAND || "";
const DEFAULT_OPENCLAW_INSTALL_COMMAND =
  process.env.OPENCLAW_INSTALL_COMMAND ||
  buildInstallScriptCommand({
    scriptPath: DEFAULT_OPENCLAW_INSTALL_SCRIPT,
    installMode: DEFAULT_OPENCLAW_INSTALL_METHOD,
    targetVersion: DEFAULT_OPENCLAW_TARGET_VERSION,
    binaryUrl: DEFAULT_OPENCLAW_BINARY_URL,
    binarySha256: DEFAULT_OPENCLAW_BINARY_SHA256,
    bootstrapUrl: DEFAULT_OPENCLAW_BOOTSTRAP_URL,
    installDir: DEFAULT_OPENCLAW_INSTALL_DIR,
    endpoint: process.env.OPENCLAW_ENDPOINT || "http://127.0.0.1:18789",
    healthPath: process.env.OPENCLAW_HEALTH_PATH || "/health",
    expectHealth: DEFAULT_OPENCLAW_EXPECT_HEALTH,
    postInstallCommand: DEFAULT_OPENCLAW_POST_INSTALL_COMMAND,
    forceReinstall: false,
  });
const DEFAULT_OPENCLAW_CHECK_COMMAND = process.env.OPENCLAW_CHECK_COMMAND || "openclaw --version";
const DEFAULT_OPENCLAW_ENDPOINT = process.env.OPENCLAW_ENDPOINT || "http://127.0.0.1:18789";
const DEFAULT_OPENCLAW_HEALTH_PATH = process.env.OPENCLAW_HEALTH_PATH || "/health";
const DEFAULT_REPAIR_RECEIVER_BASE_URL = process.env.REPAIR_RECEIVER_BASE_URL || "http://127.0.0.1:8788";

const MAX_BODY_BYTES = 1024 * 1024 * 5;
const CONTENT_TYPE_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".jar": "application/java-archive",
  ".whl": "application/zip",
  ".tgz": "application/gzip",
  ".gz": "application/gzip",
  ".zip": "application/zip",
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
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildInstallScriptCommand({
  scriptPath,
  installMode,
  targetVersion,
  binaryUrl,
  binarySha256,
  bootstrapUrl,
  installDir,
  endpoint,
  healthPath,
  expectHealth,
  postInstallCommand,
  forceReinstall,
}) {
  const assignments = [];
  const pushEnv = (name, rawValue) => {
    if (rawValue === undefined || rawValue === null) {
      return;
    }
    const value = String(rawValue);
    if (!value.trim()) {
      return;
    }
    assignments.push(`${name}=${shellQuote(value)}`);
  };

  pushEnv("OPENCLAW_INSTALL_METHOD", installMode);
  pushEnv("OPENCLAW_TARGET_VERSION", targetVersion);
  pushEnv("OPENCLAW_BINARY_URL", binaryUrl);
  pushEnv("OPENCLAW_BINARY_SHA256", binarySha256);
  pushEnv("OPENCLAW_BOOTSTRAP_URL", bootstrapUrl);
  pushEnv("OPENCLAW_INSTALL_DIR", installDir);
  pushEnv("OPENCLAW_ENDPOINT", endpoint);
  pushEnv("OPENCLAW_HEALTH_PATH", healthPath);
  pushEnv("OPENCLAW_POST_INSTALL_COMMAND", postInstallCommand);
  pushEnv("OPENCLAW_EXPECT_HEALTH", expectHealth ? "1" : "0");

  const commandParts = [];
  if (assignments.length > 0) {
    commandParts.push(assignments.join(" "));
  }
  commandParts.push(`/bin/bash ${shellQuote(scriptPath)} --non-interactive`);
  if (forceReinstall) {
    commandParts.push("--force");
  }
  return commandParts.join(" ");
}

function createClientError(message, statusCode = 400, errorCode = "ERR-1001") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function payloadHash(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
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

async function readRawBody(req) {
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

  return Buffer.concat(chunks);
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

function normalizeDownloadPath(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw);
    return parsed.pathname || "";
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizePackageFile(file) {
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    return null;
  }

  const fileName = String(file.fileName || "").trim();
  const downloadPath = normalizeDownloadPath(file.downloadPath || file.relativePath || file.fileName);
  if (!fileName || !downloadPath) {
    return null;
  }

  const sizeNum = Number(file.sizeBytes);
  return {
    fileName,
    relativePath: String(file.relativePath || "").trim(),
    downloadPath,
    sizeBytes: Number.isFinite(sizeNum) && sizeNum >= 0 ? Math.trunc(sizeNum) : 0,
    sha256: String(file.sha256 || "").trim(),
    contentType: String(file.contentType || "application/octet-stream"),
  };
}

function normalizePackageEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const language = String(entry.language || "").trim();
  const packageName = String(entry.packageName || "").trim();
  if (!language || !packageName) {
    return null;
  }

  const files = Array.isArray(entry.files) ? entry.files.map(normalizePackageFile).filter(Boolean) : [];
  if (files.length === 0) {
    return null;
  }

  const commands = Array.isArray(entry.installCommands)
    ? entry.installCommands.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return {
    key: entry.key ? String(entry.key) : `${language}:${packageName}`,
    language,
    ecosystem: String(entry.ecosystem || "").trim() || "generic",
    packageName,
    version: String(entry.version || "").trim() || "unknown",
    summary: String(entry.summary || "").trim(),
    installCommands: commands,
    files,
  };
}

async function readPackageCatalog(packageCatalogFilePath) {
  try {
    const text = await fs.readFile(packageCatalogFilePath, "utf8");
    const parsed = JSON.parse(text);
    const packages = Array.isArray(parsed.packages) ? parsed.packages.map(normalizePackageEntry).filter(Boolean) : [];

    return {
      schemaVersion: String(parsed.schemaVersion || "v1"),
      generatedAt: parsed.generatedAt ? String(parsed.generatedAt) : null,
      buildCommand: String(parsed.buildCommand || "npm run sdk:package"),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map((item) => String(item || "")) : [],
      packages,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: "v1",
        generatedAt: null,
        buildCommand: "npm run sdk:package",
        warnings: ["Package catalog not found. Build packages first."],
        packages: [],
      };
    }
    throw error;
  }
}

function resolveBaseUrl(req) {
  const protoHeader = normalizeHeaderValue(req.headers["x-forwarded-proto"]).split(",")[0].trim().toLowerCase();
  const protocol = protoHeader === "https" ? "https" : "http";
  const host = normalizeHeaderValue(req.headers.host).trim() || `${DEFAULT_HOST}:${DEFAULT_PORT}`;
  return `${protocol}://${host}`;
}

function detectLevelFromText(text) {
  const value = String(text || "").toLowerCase();
  if (/(fatal|panic|uncaught|exception|error)/.test(value)) {
    return "error";
  }
  if (/(warn|degraded|slow)/.test(value)) {
    return "warn";
  }
  if (/(debug|trace)/.test(value)) {
    return "debug";
  }
  return "info";
}

function detectTraceIdFromText(text) {
  const value = String(text || "");
  const match =
    value.match(/\btrace(?:Id|_id|ID)?[=: ]([a-zA-Z0-9_-]{8,})/) ||
    value.match(/\bx-request-id[=: ]([a-zA-Z0-9_-]{8,})/i) ||
    value.match(/\brequestId[=: ]([a-zA-Z0-9_-]{8,})/i);
  return match ? match[1] : null;
}

function parseSyslogLine(line) {
  const raw = String(line || "").trim();
  if (!raw) {
    return null;
  }
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return {
        level: obj.level || obj.severity || detectLevelFromText(raw),
        message: obj.message || obj.msg || raw,
        traceId: obj.traceId || obj.trace_id || obj.requestId || detectTraceIdFromText(raw),
        timestamp: obj.timestamp || obj.time || obj["@timestamp"] || null,
        path: obj.path || obj.url || null,
        method: obj.method || null,
        statusCode: obj.statusCode || obj.status || null,
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
    }
  } catch {
    // ignore parse error
  }
  return {
    level: detectLevelFromText(raw),
    message: raw,
    traceId: detectTraceIdFromText(raw),
    timestamp: null,
    path: null,
    method: null,
    statusCode: null,
    error: null,
    meta: {},
  };
}

function validateEventIngestPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createClientError("payload must be an object");
  }

  const projectKey = String(body.projectKey || "").trim();
  if (!projectKey) {
    throw createClientError("projectKey is required");
  }

  const eventId = String(body.eventId || "").trim();
  if (!eventId) {
    throw createClientError("eventId is required");
  }

  const sourceType = String(body.sourceType || "").trim();
  const supportedTypes = new Set(["feedback", "log", "alert"]);
  if (!supportedTypes.has(sourceType)) {
    throw createClientError("sourceType must be one of feedback/log/alert");
  }

  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    throw createClientError("payload field must be an object");
  }

  return {
    projectKey,
    eventId,
    sourceType,
    traceId: body.traceId ? String(body.traceId) : null,
    sessionId: body.sessionId ? String(body.sessionId) : null,
    userId: body.userId ? String(body.userId) : null,
    payload: body.payload,
  };
}

function parseBooleanQuery(value, fieldName = "value") {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  throw createClientError(`${fieldName} must be true/false`);
}

function validateExecutorProfile(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createClientError("payload must be an object");
  }

  const executorKey = String(body.executorKey || "").trim();
  if (!executorKey) {
    throw createClientError("executorKey is required");
  }

  const endpoint = String(body.endpoint || "").trim();
  if (!endpoint) {
    throw createClientError("endpoint is required");
  }

  const kind = body.kind === undefined ? undefined : String(body.kind || "").trim();
  if (body.kind !== undefined && !kind) {
    throw createClientError("kind cannot be empty");
  }

  let enabled;
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      throw createClientError("enabled must be boolean");
    }
    enabled = body.enabled;
  }

  let priority;
  if (body.priority !== undefined) {
    const parsed = Number(body.priority);
    if (!Number.isFinite(parsed)) {
      throw createClientError("priority must be a number");
    }
    priority = Math.trunc(parsed);
  }

  return {
    executorKey,
    kind,
    endpoint,
    enabled,
    priority,
  };
}

function validateProjectProfile(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createClientError("payload must be an object");
  }

  const projectKey = String(body.projectKey || "").trim();
  if (!projectKey) {
    throw createClientError("projectKey is required");
  }

  const repoUrl = String(body.repoUrl || "").trim();
  if (!repoUrl) {
    throw createClientError("repoUrl is required");
  }

  const defaultBranch = body.defaultBranch === undefined ? undefined : String(body.defaultBranch || "").trim();
  if (body.defaultBranch !== undefined && !defaultBranch) {
    throw createClientError("defaultBranch cannot be empty");
  }

  const status = body.status === undefined ? undefined : String(body.status || "").trim();
  if (body.status !== undefined && !status) {
    throw createClientError("status cannot be empty");
  }

  const services = parseStringArray(body.services, "services");

  return {
    projectKey,
    repoUrl,
    defaultBranch,
    status,
    services,
  };
}

function validateModelPolicy(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createClientError("payload must be an object");
  }

  const projectKey = String(body.projectKey || "").trim();
  if (!projectKey) {
    throw createClientError("projectKey is required");
  }

  const tiers = new Set(["economy", "performance", "ultimate"]);
  const defaultModelTier = String(body.defaultModelTier || "").trim();
  if (!tiers.has(defaultModelTier)) {
    throw createClientError("defaultModelTier must be one of economy/performance/ultimate");
  }

  if (
    body.upgradeRules !== undefined &&
    (!body.upgradeRules || typeof body.upgradeRules !== "object" || Array.isArray(body.upgradeRules))
  ) {
    throw createClientError("upgradeRules must be an object");
  }

  const policyName = body.policyName === undefined ? undefined : String(body.policyName || "").trim();
  if (body.policyName !== undefined && !policyName) {
    throw createClientError("policyName cannot be empty");
  }

  const budgetDailyTokens =
    body.budgetDailyTokens === undefined ? undefined : Number.parseInt(String(body.budgetDailyTokens), 10);
  if (body.budgetDailyTokens !== undefined && !Number.isFinite(budgetDailyTokens)) {
    throw createClientError("budgetDailyTokens must be an integer");
  }

  const budgetTaskTokens =
    body.budgetTaskTokens === undefined ? undefined : Number.parseInt(String(body.budgetTaskTokens), 10);
  if (body.budgetTaskTokens !== undefined && !Number.isFinite(budgetTaskTokens)) {
    throw createClientError("budgetTaskTokens must be an integer");
  }

  return {
    projectKey,
    policyName,
    defaultModelTier,
    upgradeRules: body.upgradeRules,
    budgetDailyTokens,
    budgetTaskTokens,
  };
}

function parseStringArray(value, fieldName) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw createClientError(`${fieldName} must be an array`);
  }
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function validateObjectField(value, fieldName) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createClientError(`${fieldName} must be an object`);
  }
  return value;
}

function validateLogCollectorProfile(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createClientError("payload must be an object");
  }

  const collectorKey = String(body.collectorKey || "").trim();
  if (!collectorKey) {
    throw createClientError("collectorKey is required");
  }

  const projectKey = String(body.projectKey || "").trim();
  if (!projectKey) {
    throw createClientError("projectKey is required");
  }

  const service = String(body.service || "").trim();
  if (!service) {
    throw createClientError("service is required");
  }

  const mode = String(body.mode || "local_file").trim();
  if (!["local_file", "command_pull", "journald", "oss_pull", "syslog_http"].includes(mode)) {
    throw createClientError("mode must be one of local_file/command_pull/journald/oss_pull/syslog_http");
  }

  let enabled;
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      throw createClientError("enabled must be boolean");
    }
    enabled = body.enabled;
  }

  const pollIntervalSecRaw = body.pollIntervalSec === undefined ? undefined : Number(body.pollIntervalSec);
  if (body.pollIntervalSec !== undefined && (!Number.isFinite(pollIntervalSecRaw) || pollIntervalSecRaw < 10)) {
    throw createClientError("pollIntervalSec must be a number >= 10");
  }

  const source = validateObjectField(body.source, "source") || {};
  if (mode === "local_file") {
    const filePath = String(source.filePath || "").trim();
    if (!filePath) {
      throw createClientError("source.filePath is required when mode=local_file");
    }
  }
  if (mode === "command_pull") {
    const command = String(source.command || "").trim();
    if (!command) {
      throw createClientError("source.command is required when mode=command_pull");
    }
  }
  if (mode === "journald") {
    const unit = String(source.unit || "").trim();
    const command = String(source.command || "").trim();
    if (!unit && !command) {
      throw createClientError("source.unit or source.command is required when mode=journald");
    }
  }
  if (mode === "oss_pull") {
    const objectUrl = String(source.objectUrl || "").trim();
    if (!objectUrl) {
      throw createClientError("source.objectUrl is required when mode=oss_pull");
    }
  }
  if (mode === "syslog_http") {
    if (source.token !== undefined && String(source.token || "").trim().length === 0) {
      throw createClientError("source.token cannot be empty when mode=syslog_http");
    }
  }

  const parse = validateObjectField(body.parse, "parse");
  if (parse && parse.format !== undefined) {
    const format = String(parse.format).trim();
    if (!["auto", "json", "nginx_access", "plain"].includes(format)) {
      throw createClientError("parse.format must be one of auto/json/nginx_access/plain");
    }
  }

  const options = validateObjectField(body.options, "options") || {};
  if (options.maxLinesPerRun !== undefined) {
    const num = Number(options.maxLinesPerRun);
    if (!Number.isFinite(num) || num <= 0) {
      throw createClientError("options.maxLinesPerRun must be a positive number");
    }
  }
  if (options.maxLinesPerPush !== undefined) {
    const num = Number(options.maxLinesPerPush);
    if (!Number.isFinite(num) || num <= 0) {
      throw createClientError("options.maxLinesPerPush must be a positive number");
    }
  }
  if (options.includePatterns !== undefined) {
    parseStringArray(options.includePatterns, "options.includePatterns");
  }
  if (options.excludePatterns !== undefined) {
    parseStringArray(options.excludePatterns, "options.excludePatterns");
  }
  if (options.staticMeta !== undefined) {
    validateObjectField(options.staticMeta, "options.staticMeta");
  }

  const state = validateObjectField(body.state, "state");
  const tags = parseStringArray(body.tags, "tags");

  return {
    collectorKey,
    projectKey,
    service,
    mode,
    enabled,
    pollIntervalSec: pollIntervalSecRaw === undefined ? undefined : Math.trunc(pollIntervalSecRaw),
    source,
    parse,
    options,
    state,
    tags,
  };
}

function parseBooleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  throw createClientError("boolean value is invalid");
}

function validateOpenClawInstallPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createClientError("payload must be an object");
  }

  const executorKey = String(body.executorKey || "openclaw-local").trim();
  const endpoint = String(body.endpoint || DEFAULT_OPENCLAW_ENDPOINT).trim();
  if (!endpoint) {
    throw createClientError("endpoint is required");
  }

  const installCommand = body.installCommand === undefined ? "" : String(body.installCommand || "").trim();
  const checkCommand = String(body.checkCommand || DEFAULT_OPENCLAW_CHECK_COMMAND).trim();
  const healthPath = String(body.healthPath || DEFAULT_OPENCLAW_HEALTH_PATH).trim() || "/health";
  const repairReceiverBaseUrl = String(body.repairReceiverBaseUrl || DEFAULT_REPAIR_RECEIVER_BASE_URL).trim();
  const installMode = String(body.installMode || DEFAULT_OPENCLAW_INSTALL_METHOD || "auto").trim().toLowerCase();
  if (!["auto", "brew", "binary", "bootstrap"].includes(installMode)) {
    throw createClientError("installMode must be one of auto/brew/binary/bootstrap");
  }

  const targetVersion = body.targetVersion === undefined ? DEFAULT_OPENCLAW_TARGET_VERSION : String(body.targetVersion).trim();
  const binaryUrl = body.binaryUrl === undefined ? DEFAULT_OPENCLAW_BINARY_URL : String(body.binaryUrl).trim();
  const binarySha256 =
    body.binarySha256 === undefined ? DEFAULT_OPENCLAW_BINARY_SHA256 : String(body.binarySha256).trim();
  const bootstrapUrl =
    body.bootstrapUrl === undefined ? DEFAULT_OPENCLAW_BOOTSTRAP_URL : String(body.bootstrapUrl).trim();
  const installDir = body.installDir === undefined ? DEFAULT_OPENCLAW_INSTALL_DIR : String(body.installDir).trim();
  const postInstallCommand =
    body.postInstallCommand === undefined ? DEFAULT_OPENCLAW_POST_INSTALL_COMMAND : String(body.postInstallCommand).trim();

  const timeoutMsRaw = body.timeoutMs === undefined ? 10 * 60 * 1000 : Number(body.timeoutMs);
  if (!Number.isFinite(timeoutMsRaw) || timeoutMsRaw <= 0) {
    throw createClientError("timeoutMs must be a positive number");
  }

  const priorityRaw = body.priority === undefined ? 80 : Number(body.priority);
  if (!Number.isFinite(priorityRaw)) {
    throw createClientError("priority must be a number");
  }

  return {
    dryRun: parseBooleanValue(body.dryRun, false),
    forceReinstall: parseBooleanValue(body.forceReinstall, false),
    autoRegisterExecutor: parseBooleanValue(body.autoRegisterExecutor, true),
    syncToRepairReceiver: parseBooleanValue(body.syncToRepairReceiver, true),
    timeoutMs: Math.trunc(timeoutMsRaw),
    executorKey,
    endpoint,
    healthPath: healthPath.startsWith("/") ? healthPath : `/${healthPath}`,
    installCommand,
    checkCommand,
    repairReceiverBaseUrl,
    installMode,
    targetVersion,
    binaryUrl,
    binarySha256,
    bootstrapUrl,
    installDir,
    expectHealth: body.expectHealth === undefined ? DEFAULT_OPENCLAW_EXPECT_HEALTH : parseBooleanValue(body.expectHealth),
    postInstallCommand,
    kind: String(body.kind || "openclaw-gateway").trim() || "openclaw-gateway",
    priority: Math.trunc(priorityRaw),
    credentialRef: body.credentialRef ? String(body.credentialRef).trim() : null,
    isDefault: parseBooleanValue(body.isDefault, false),
    executePath: String(body.executePath || "/v1/execute-repair").trim() || "/v1/execute-repair",
  };
}

async function resolveOpenClawInstallCommand(config) {
  if (config.installCommand) {
    return {
      command: config.installCommand,
      source: "request.installCommand",
      scriptPath: null,
    };
  }

  if (process.env.OPENCLAW_INSTALL_COMMAND && String(process.env.OPENCLAW_INSTALL_COMMAND).trim()) {
    return {
      command: String(process.env.OPENCLAW_INSTALL_COMMAND).trim(),
      source: "env.OPENCLAW_INSTALL_COMMAND",
      scriptPath: null,
    };
  }

  if (config.installMode === "binary" && !config.binaryUrl) {
    throw createClientError("binaryUrl is required when installMode=binary");
  }
  if (config.installMode === "bootstrap" && !config.bootstrapUrl) {
    throw createClientError("bootstrapUrl is required when installMode=bootstrap");
  }

  try {
    await fs.access(DEFAULT_OPENCLAW_INSTALL_SCRIPT);
  } catch {
    throw createClientError(
      `default install script not found: ${DEFAULT_OPENCLAW_INSTALL_SCRIPT}. Provide installCommand explicitly.`,
      400,
      "ERR-1001",
    );
  }

  const command = buildInstallScriptCommand({
    scriptPath: DEFAULT_OPENCLAW_INSTALL_SCRIPT,
    installMode: config.installMode,
    targetVersion: config.targetVersion,
    binaryUrl: config.binaryUrl,
    binarySha256: config.binarySha256,
    bootstrapUrl: config.bootstrapUrl,
    installDir: config.installDir,
    endpoint: config.endpoint,
    healthPath: config.healthPath,
    expectHealth: config.expectHealth,
    postInstallCommand: config.postInstallCommand,
    forceReinstall: config.forceReinstall,
  });
  return {
    command,
    source: "default.install_script",
    scriptPath: DEFAULT_OPENCLAW_INSTALL_SCRIPT,
  };
}

function parseTopicValue(value, fieldName = "topic") {
  try {
    return validateTopic(value);
  } catch (error) {
    throw createClientError(`${fieldName}: ${error.message}`);
  }
}

function buildEventIngestLog(eventPayload, req) {
  const payload = eventPayload.payload || {};
  return buildIngestedLog({
    source: eventPayload.sourceType === "log" ? "backend" : "frontend",
    req,
    body: {
      traceId: eventPayload.traceId || undefined,
      level: payload.level || "info",
      service: payload.service || req.headers["x-service-name"] || `event-${eventPayload.sourceType}`,
      message: payload.message || `event_ingested:${eventPayload.sourceType}`,
      path: payload.path || null,
      method: payload.method || null,
      statusCode: payload.statusCode || null,
      error: payload.error || null,
      meta: {
        ...(payload.meta || {}),
        projectKey: eventPayload.projectKey,
        eventId: eventPayload.eventId,
        sourceType: eventPayload.sourceType,
      },
    },
  });
}

function resolveOperator(req) {
  const rawType = normalizeHeaderValue(req.headers["x-operator-type"]).trim().toLowerCase();
  const operatorType = ["agent", "human", "system"].includes(rawType) ? rawType : "system";
  const operatorId = normalizeHeaderValue(req.headers["x-operator-id"]).trim() || "trace-log-platform";
  return { operatorType, operatorId };
}

async function writeAuditLog(store, req, payload) {
  if (!store || typeof store.addAuditLog !== "function") {
    return;
  }
  const operator = resolveOperator(req);
  await store.addAuditLog({
    id: generateId("audit_", 8),
    entityType: payload.entityType,
    entityId: payload.entityId,
    action: payload.action,
    operatorType: payload.operatorType || operator.operatorType,
    operatorId: payload.operatorId || operator.operatorId,
    metadata: payload.metadata || {},
    createdAt: nowIso(),
  });
}

function publishQueueEvent(queueBroker, routeContext, payload) {
  if (!queueBroker || typeof queueBroker.publish !== "function") {
    return null;
  }
  const envelope = buildEventEnvelope({
    topic: payload.topic,
    eventType: payload.eventType,
    eventVersion: payload.eventVersion || "v1",
    traceId: routeContext?.traceContext?.traceId || null,
    correlationId: payload.correlationId || null,
    payload: payload.payload || {},
    metadata: payload.metadata || {},
  });
  validateEventEnvelope(envelope);
  return queueBroker.publish(payload.topic, envelope);
}

function buildRepairReceiverExecutorPayload(config) {
  return {
    executorKey: config.executorKey,
    kind: config.kind,
    endpoint: config.endpoint,
    executePath: config.executePath,
    healthPath: config.healthPath,
    credentialRef: config.credentialRef,
    priority: config.priority,
    enabled: true,
    isDefault: config.isDefault,
    agents: {
      preferred: ["codex", "claude-code"],
      fallback: ["codex"],
    },
    machine: {
      label: "openclaw-local",
      region: "local",
    },
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

function dashboardPayload(store, scheduler, { projectKey } = {}) {
  return {
    generatedAt: nowIso(),
    scope: {
      projectKey: projectKey || null,
    },
    overview: store.getOverview({ minutes: 60, projectKey }),
    errorTrend: store.getErrorTrend({ hours: 24, bucketMinutes: 60, projectKey }),
    services: store.getServiceOverview({ minutes: 60, projectKey }),
    topErrors: store.getTopErrors({ limit: 8, hours: 24, projectKey }),
    traces: store.listTraceSummaries({ limit: 20, projectKey }),
    bugs: store.listBugs({ projectKey }).slice(0, 20),
    repairTasks: store.listRepairTasks({ projectKey }).slice(0, 20),
    scheduler: scheduler.snapshot(),
  };
}

async function handleApiRoute(
  req,
  res,
  store,
  routeContext,
  scheduler,
  queueBroker,
  collectorEngine,
  packageCatalogFilePath,
) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === "GET" && pathname === "/health") {
    const queueTopics = queueBroker.listTopics();
    const queueDepth = queueTopics.reduce((sum, item) => sum + item.depth, 0);
    const dlqDepth = queueTopics.reduce((sum, item) => sum + item.dlqDepth, 0);
    return sendJson(res, 200, {
      ok: true,
      service: "trace-log-platform",
      now: nowIso(),
      stats: store.getStats(),
      queue: {
        topicCount: queueTopics.length,
        queueDepth,
        dlqDepth,
      },
      scheduler: scheduler.snapshot(),
    });
  }

  if (method === "GET" && pathname === "/v1/system/openclaw/status") {
    const executorKey = String(url.searchParams.get("executorKey") || "openclaw-local").trim();
    const checkCommand = String(url.searchParams.get("checkCommand") || DEFAULT_OPENCLAW_CHECK_COMMAND).trim();
    const endpoint = String(url.searchParams.get("endpoint") || DEFAULT_OPENCLAW_ENDPOINT).trim();
    const healthPath = String(url.searchParams.get("healthPath") || DEFAULT_OPENCLAW_HEALTH_PATH).trim();
    const checkRepairReceiver = parseBooleanQuery(url.searchParams.get("checkRepairReceiver"), "checkRepairReceiver");
    const repairReceiverBaseUrl = String(
      url.searchParams.get("repairReceiverBaseUrl") || DEFAULT_REPAIR_RECEIVER_BASE_URL,
    ).trim();

    const openclaw = await probeOpenClaw({
      checkCommand,
    });
    const endpointHealth = await checkOpenClawEndpointHealth({
      endpoint,
      healthPath,
    });

    const executors = store
      .listExecutors({ limit: 1000 })
      .filter((item) => item.executorKey === executorKey || String(item.kind || "").includes("openclaw"));

    let repairReceiver = null;
    if (checkRepairReceiver) {
      try {
        const checkUrl = new URL(
          `/v1/config/executors/${encodeURIComponent(executorKey)}`,
          repairReceiverBaseUrl,
        ).toString();
        const res = await fetch(checkUrl, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        const raw = await res.text();
        repairReceiver = {
          ok: res.ok,
          statusCode: res.status,
          response: raw,
        };
      } catch (error) {
        repairReceiver = {
          ok: false,
          statusCode: null,
          response: null,
          error: error.message || String(error),
        };
      }
    }

    return sendJson(res, 200, {
      ok: true,
      openclaw,
      endpointHealth,
      installer: {
        scriptPath: DEFAULT_OPENCLAW_INSTALL_SCRIPT,
        defaultInstallCommand: DEFAULT_OPENCLAW_INSTALL_COMMAND,
        defaults: {
          installMode: DEFAULT_OPENCLAW_INSTALL_METHOD,
          targetVersion: DEFAULT_OPENCLAW_TARGET_VERSION || null,
          binaryUrl: DEFAULT_OPENCLAW_BINARY_URL || null,
          bootstrapUrl: DEFAULT_OPENCLAW_BOOTSTRAP_URL || null,
          installDir: DEFAULT_OPENCLAW_INSTALL_DIR || null,
          expectHealth: DEFAULT_OPENCLAW_EXPECT_HEALTH,
        },
      },
      executors,
      repairReceiver,
    });
  }

  if (method === "POST" && pathname === "/v1/system/openclaw/install") {
    const body = await readJsonBody(req);
    const config = validateOpenClawInstallPayload(body);

    const before = await probeOpenClaw({
      checkCommand: config.checkCommand,
    });

    let effectiveInstallCommand = config.installCommand || "";
    let installCommandSource = config.installCommand ? "request.installCommand" : "default.install_script";
    let installScriptPath = null;
    let install = {
      executed: false,
      skipped: false,
      dryRun: config.dryRun,
      installCommand: effectiveInstallCommand || null,
      commandSource: installCommandSource,
      scriptPath: installScriptPath,
    };

    if (!before.installed || config.forceReinstall) {
      const installCommandMeta = await resolveOpenClawInstallCommand(config);
      effectiveInstallCommand = installCommandMeta.command;
      installCommandSource = installCommandMeta.source;
      installScriptPath = installCommandMeta.scriptPath;
      install.commandSource = installCommandSource;
      install.scriptPath = installScriptPath;
      install.installCommand = effectiveInstallCommand || null;

      try {
        const result = await runOpenClawInstall({
          installCommand: effectiveInstallCommand,
          dryRun: config.dryRun,
          timeoutMs: config.timeoutMs,
        });
        install = {
          ...install,
          ...result,
        };
      } catch (error) {
        const err = new Error(`OpenClaw install failed: ${error.message || String(error)}`);
        err.statusCode = 502;
        err.errorCode = "ERR-2001";
        throw err;
      }
    } else {
      install.skipped = true;
      install.reason = "already_installed";
      if (!install.installCommand) {
        install.installCommand = "SKIPPED_ALREADY_INSTALLED";
      }
    }

    const after = await probeOpenClaw({
      checkCommand: config.checkCommand,
    });
    const endpointHealth = await checkOpenClawEndpointHealth({
      endpoint: config.endpoint,
      healthPath: config.healthPath,
    });

    let localExecutor = null;
    if (config.autoRegisterExecutor) {
      localExecutor = await store.upsertExecutor({
        executorKey: config.executorKey,
        kind: config.kind,
        endpoint: config.endpoint,
        enabled: true,
        priority: config.priority,
      });

      publishQueueEvent(queueBroker, routeContext, {
        topic: "ops.events.system.openclaw",
        eventType: "openclaw.executor_registered",
        eventVersion: "v1",
        payload: {
          executorKey: localExecutor.executorKey,
          endpoint: localExecutor.endpoint,
          installed: after.installed,
        },
      });

      await writeAuditLog(store, req, {
        entityType: "executor_profile",
        entityId: localExecutor.executorKey,
        action: "openclaw.executor.auto_register",
        metadata: {
          endpoint: localExecutor.endpoint,
          kind: localExecutor.kind,
          priority: localExecutor.priority,
        },
      });
    }

    let repairReceiverSync = null;
    if (config.syncToRepairReceiver) {
      repairReceiverSync = await syncExecutorToRepairReceiver({
        baseUrl: config.repairReceiverBaseUrl,
        executorPayload: buildRepairReceiverExecutorPayload(config),
      });
    }

    await writeAuditLog(store, req, {
      entityType: "system",
      entityId: "openclaw",
      action: "openclaw.install",
      metadata: {
        installedBefore: before.installed,
        installedAfter: after.installed,
        dryRun: config.dryRun,
        forceReinstall: config.forceReinstall,
        commandSource: install.commandSource,
        installScriptPath,
        endpoint: config.endpoint,
        endpointHealthOk: endpointHealth.ok,
        localExecutorRegistered: Boolean(localExecutor),
        repairReceiverSyncOk: repairReceiverSync ? repairReceiverSync.ok : null,
      },
    });

    publishQueueEvent(queueBroker, routeContext, {
      topic: "ops.events.system.openclaw",
      eventType: "openclaw.install.completed",
      eventVersion: "v1",
      payload: {
        installed: after.installed,
        dryRun: config.dryRun,
        endpoint: config.endpoint,
        executorKey: config.executorKey,
        repairReceiverSyncOk: repairReceiverSync ? repairReceiverSync.ok : null,
      },
    });

    return sendJson(res, 200, {
      ok: true,
      before,
      install,
      after,
      endpointHealth,
      localExecutor,
      repairReceiverSync,
    });
  }

  if (method === "GET" && pathname === "/v1/system/queue/topics") {
    const topics = queueBroker.listTopics();
    return sendJson(res, 200, {
      ok: true,
      count: topics.length,
      topics,
    });
  }

  if (method === "POST" && pathname === "/v1/system/queue/publish") {
    const body = await readJsonBody(req);
    const topic = parseTopicValue(body.topic);
    const envelope = buildEventEnvelope({
      topic,
      eventType: String(body.eventType || "").trim() || "generic.event",
      eventVersion: String(body.eventVersion || "v1"),
      payload: body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {},
      metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {},
      traceId: routeContext.traceContext.traceId,
      correlationId: body.correlationId ? String(body.correlationId) : null,
    });
    queueBroker.publish(topic, envelope);
    return sendJson(res, 202, {
      ok: true,
      topic,
      eventId: envelope.id,
    });
  }

  if (method === "POST" && pathname === "/v1/system/queue/process-next") {
    const body = await readJsonBody(req);
    const topic = parseTopicValue(body.topic);
    const pulled = queueBroker.pull(topic, { limit: 1 });
    if (pulled.length === 0) {
      return sendJson(res, 404, {
        ok: false,
        errorCode: "ERR-1003",
        error: "No message available",
      });
    }

    const envelope = pulled[0];
    if (body.fail === true) {
      const result = queueBroker.nack(topic, envelope, {
        reason: body.reason ? String(body.reason) : "manual-failure",
        maxAttempts: asInt(body.maxAttempts, undefined),
      });
      return sendJson(res, 200, {
        ok: true,
        processed: false,
        movedToDlq: result.movedToDlq,
        envelope: result.envelope,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      processed: true,
      envelope,
    });
  }

  if (method === "GET" && pathname === "/v1/system/queue/dlq") {
    const topic = parseTopicValue(url.searchParams.get("topic"));
    const items = queueBroker.peekDlq(topic, {
      limit: asInt(url.searchParams.get("limit"), 50),
    });
    return sendJson(res, 200, {
      ok: true,
      topic,
      count: items.length,
      items,
    });
  }

  if (method === "GET" && pathname === "/v1/audit-logs") {
    const items = store.listAuditLogs({
      entityType: url.searchParams.get("entityType") || undefined,
      entityId: url.searchParams.get("entityId") || undefined,
      action: url.searchParams.get("action") || undefined,
      operatorType: url.searchParams.get("operatorType") || undefined,
      limit: asInt(url.searchParams.get("limit"), 200),
    });
    return sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
    });
  }

  if (method === "POST" && pathname === "/v1/logs/syslog") {
    const raw = await readRawBody(req);
    const contentType = String(req.headers["content-type"] || "").toLowerCase();
    let collectorKey = normalizeHeaderValue(req.headers["x-collector-key"]).trim();
    const collectorToken = normalizeHeaderValue(req.headers["x-collector-token"]).trim();

    let lines = [];
    if (contentType.includes("application/json")) {
      const text = raw.toString("utf8").trim();
      if (!text) {
        throw createClientError("request body cannot be empty");
      }
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {
        throw createClientError("invalid JSON payload");
      }
      if (!collectorKey) {
        collectorKey = String(body.collectorKey || "").trim();
      }
      if (Array.isArray(body.lines)) {
        lines = body.lines.map((item) => String(item || "")).filter(Boolean);
      } else if (body.message !== undefined) {
        lines = [String(body.message || "")].filter(Boolean);
      } else if (typeof body === "object" && body) {
        lines = [JSON.stringify(body)];
      }
    } else {
      lines = raw
        .toString("utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }

    if (!collectorKey) {
      throw createClientError("collectorKey is required via x-collector-key or body.collectorKey");
    }
    const collector = store.getLogCollector(collectorKey);
    if (!collector) {
      return sendJson(res, 404, {
        ok: false,
        errorCode: "ERR-1003",
        error: "Collector not found",
      });
    }
    if (collector.mode !== "syslog_http") {
      throw createClientError(`collector ${collectorKey} is not syslog_http mode`);
    }
    if (!collector.enabled) {
      return sendJson(res, 409, {
        ok: false,
        errorCode: "ERR-1002",
        error: "Collector is disabled",
      });
    }
    const expectedToken = String(collector.source?.token || "").trim();
    if (expectedToken && collectorToken !== expectedToken) {
      return sendJson(res, 401, {
        ok: false,
        errorCode: "ERR-1002",
        error: "Invalid collector token",
      });
    }

    const maxLines = Math.max(1, asInt(collector.options?.maxLinesPerPush, 2000));
    const fallbackTraceId = createTraceContext({
      service: collector.service,
      source: "backend",
    }).traceId;
    const acceptedLines = lines.slice(0, maxLines);
    const logs = [];
    for (const line of acceptedLines) {
      const parsed = parseSyslogLine(line);
      if (!parsed) {
        continue;
      }
      logs.push({
        id: generateId("log_", 8),
        timestamp: parsed.timestamp || nowIso(),
        source: "backend",
        service: collector.service,
        traceId: parsed.traceId || fallbackTraceId,
        spanId: generateId("sp_", 8),
        parentSpanId: null,
        level: parsed.level || "info",
        message: parsed.message || line,
        path: parsed.path || null,
        method: parsed.method || null,
        statusCode: parsed.statusCode || null,
        error: parsed.error ? sanitizeError(parsed.error) : null,
        meta: {
          projectKey: collector.projectKey,
          collectorKey: collector.collectorKey,
          collectorMode: collector.mode,
          remoteAddress: req.socket?.remoteAddress || null,
          ...(collector.options?.staticMeta && typeof collector.options.staticMeta === "object"
            ? collector.options.staticMeta
            : {}),
          ...(parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {}),
        },
      });
    }

    if (logs.length > 0) {
      await store.addLogs(logs);
    }
    await store.patchLogCollectorState(collector.collectorKey, {
      lastRunAt: nowIso(),
      lastPushAt: nowIso(),
      lastStatus: "success",
      lastError: null,
      lastIngestedCount: logs.length,
      lastScannedCount: acceptedLines.length,
    });
    await store.addCollectorRun({
      collectorKey: collector.collectorKey,
      trigger: "push",
      status: "success",
      startedAt: nowIso(),
      finishedAt: nowIso(),
      scannedCount: acceptedLines.length,
      ingestedCount: logs.length,
      message: `syslog push ingested ${logs.length}/${acceptedLines.length}`,
      metadata: {
        mode: collector.mode,
        projectKey: collector.projectKey,
        service: collector.service,
      },
    });
    return sendJson(res, 201, {
      ok: true,
      collectorKey: collector.collectorKey,
      count: logs.length,
      dropped: Math.max(0, lines.length - acceptedLines.length),
    });
  }

  if (method === "POST" && pathname === "/v1/logs/frontend") {
    const body = await readJsonBody(req);
    const log = buildIngestedLog({ body, source: "frontend", req });
    await store.addLog(log);
    return sendJson(res, 201, { ok: true, logId: log.id, traceId: log.traceId });
  }

  if (method === "GET" && pathname === "/v1/config/executors") {
    const enabled = parseBooleanQuery(url.searchParams.get("enabled"), "enabled");
    const executors = store.listExecutors({
      enabled,
      kind: url.searchParams.get("kind") || undefined,
      limit: asInt(url.searchParams.get("limit"), 200),
    });
    return sendJson(res, 200, {
      ok: true,
      count: executors.length,
      executors,
    });
  }

  if (method === "POST" && pathname === "/v1/config/executors") {
    const body = await readJsonBody(req);
    const profile = validateExecutorProfile(body);
    const executor = await store.upsertExecutor(profile);
    publishQueueEvent(queueBroker, routeContext, {
      topic: "ops.events.config.executor",
      eventType: "config.executor.upserted",
      eventVersion: "v1",
      payload: {
        executorKey: executor.executorKey,
        kind: executor.kind,
        enabled: executor.enabled,
        priority: executor.priority,
      },
    });
    await writeAuditLog(store, req, {
      entityType: "executor_profile",
      entityId: executor.executorKey,
      action: "config.executor.upsert",
      metadata: {
        kind: executor.kind,
        endpoint: executor.endpoint,
        enabled: executor.enabled,
        priority: executor.priority,
      },
    });
    return sendJson(res, 200, {
      ok: true,
      executor,
    });
  }

  if (method === "GET" && pathname === "/v1/config/projects") {
    const projects = store.listProjects({
      status: url.searchParams.get("status") || undefined,
      limit: asInt(url.searchParams.get("limit"), 200),
    });
    return sendJson(res, 200, {
      ok: true,
      count: projects.length,
      projects,
    });
  }

  if (method === "POST" && pathname === "/v1/config/projects") {
    const body = await readJsonBody(req);
    const profile = validateProjectProfile(body);
    const project = await store.upsertProject(profile);
    publishQueueEvent(queueBroker, routeContext, {
      topic: "ops.events.config.project",
      eventType: "config.project.upserted",
      eventVersion: "v1",
      payload: {
        projectKey: project.projectKey,
        defaultBranch: project.defaultBranch,
        status: project.status,
      },
    });
    await writeAuditLog(store, req, {
      entityType: "project",
      entityId: project.projectKey,
      action: "config.project.upsert",
      metadata: {
        repoUrl: project.repoUrl,
        defaultBranch: project.defaultBranch,
        status: project.status,
        services: project.services || [],
      },
    });
    return sendJson(res, 200, {
      ok: true,
      project,
    });
  }

  if (method === "GET" && pathname === "/v1/system/contexts") {
    const contexts = store.listProjectContexts({
      minutes: asInt(url.searchParams.get("minutes"), 60),
      includeInactive: parseBooleanValue(url.searchParams.get("includeInactive"), true),
    });
    return sendJson(res, 200, {
      ok: true,
      count: contexts.length,
      contexts,
    });
  }

  if (method === "GET" && pathname === "/v1/config/model-policies") {
    const policies = store.listModelPolicies({
      projectKey: url.searchParams.get("projectKey") || undefined,
      defaultModelTier: url.searchParams.get("defaultModelTier") || undefined,
      limit: asInt(url.searchParams.get("limit"), 200),
    });
    return sendJson(res, 200, {
      ok: true,
      count: policies.length,
      policies,
    });
  }

  if (method === "POST" && pathname === "/v1/config/model-policies") {
    const body = await readJsonBody(req);
    const policyPayload = validateModelPolicy(body);
    const policy = await store.upsertModelPolicy(policyPayload);
    publishQueueEvent(queueBroker, routeContext, {
      topic: "ops.events.config.model_policy",
      eventType: "config.model_policy.upserted",
      eventVersion: "v1",
      payload: {
        projectKey: policy.projectKey,
        policyName: policy.policyName,
        defaultModelTier: policy.defaultModelTier,
      },
    });
    await writeAuditLog(store, req, {
      entityType: "model_policy",
      entityId: `${policy.projectKey}:${policy.policyName}`,
      action: "config.model_policy.upsert",
      metadata: {
        defaultModelTier: policy.defaultModelTier,
        budgetDailyTokens: policy.budgetDailyTokens,
        budgetTaskTokens: policy.budgetTaskTokens,
      },
    });
    return sendJson(res, 200, {
      ok: true,
      policy,
    });
  }

  if (method === "GET" && pathname === "/v1/integration/packages") {
    const baseUrl = resolveBaseUrl(req);
    const catalog = await readPackageCatalog(packageCatalogFilePath);
    const packages = catalog.packages.map((item) => ({
      ...item,
      files: item.files.map((file) => ({
        ...file,
        downloadUrl: new URL(file.downloadPath, baseUrl).toString(),
      })),
    }));
    return sendJson(res, 200, {
      ok: true,
      schemaVersion: catalog.schemaVersion,
      generatedAt: catalog.generatedAt,
      buildCommand: catalog.buildCommand,
      warnings: catalog.warnings,
      count: packages.length,
      packages,
    });
  }

  if (method === "GET" && pathname === "/v1/log-collectors/capabilities") {
    return sendJson(res, 200, {
      ok: true,
      modes: [
        {
          mode: "local_file",
          title: "本机文件采集",
          description: "部署在业务机器同主机时，直接增量读取日志文件",
          requiredSourceFields: ["filePath"],
          optionalSourceFields: ["encoding", "fromEndOnFirstRun", "maxReadBytes"],
        },
        {
          mode: "command_pull",
          title: "命令拉取采集",
          description: "通过命令执行拉取日志，可用于 ssh 到远端主机读取日志",
          requiredSourceFields: ["command"],
          optionalSourceFields: ["timeoutMs", "maxBuffer"],
          hint: "示例命令: ssh ops@10.0.0.8 'tail -n 500 /var/log/nginx/access.log'",
        },
        {
          mode: "journald",
          title: "Journald 采集",
          description: "读取 systemd journal，适合 Linux 服务进程",
          requiredSourceFields: ["unit"],
          optionalSourceFields: ["since", "lines", "timeoutMs", "maxBuffer", "command"],
        },
        {
          mode: "oss_pull",
          title: "OSS 对象拉取",
          description: "通过 objectUrl 增量 Range 拉取对象日志，适合已归档到 OSS 的系统",
          requiredSourceFields: ["objectUrl"],
          optionalSourceFields: ["headers", "encoding", "maxReadBytes", "timeoutMs"],
        },
        {
          mode: "syslog_http",
          title: "Syslog HTTP",
          description: "通过 rsyslog/syslog-ng 转发到 HTTP 接口，不改业务代码",
          requiredSourceFields: [],
          optionalSourceFields: ["token"],
          pushEndpoint: "/v1/logs/syslog",
          requiredHeaders: ["x-collector-key"],
        },
      ],
      parseFormats: ["auto", "json", "nginx_access", "plain"],
    });
  }

  if (method === "GET" && pathname === "/v1/config/log-collectors") {
    const enabled = parseBooleanQuery(url.searchParams.get("enabled"), "enabled");
    const collectors = store.listLogCollectors({
      enabled,
      mode: url.searchParams.get("mode") || undefined,
      projectKey: url.searchParams.get("projectKey") || undefined,
      service: url.searchParams.get("service") || undefined,
      limit: asInt(url.searchParams.get("limit"), 200),
    });
    return sendJson(res, 200, {
      ok: true,
      count: collectors.length,
      collectors,
    });
  }

  if (method === "POST" && pathname === "/v1/config/log-collectors") {
    const body = await readJsonBody(req);
    const profile = validateLogCollectorProfile(body);
    const collector = await store.upsertLogCollector(profile);
    await writeAuditLog(store, req, {
      entityType: "log_collector",
      entityId: collector.collectorKey,
      action: "config.log_collector.upsert",
      metadata: {
        projectKey: collector.projectKey,
        service: collector.service,
        mode: collector.mode,
        enabled: collector.enabled,
      },
    });
    return sendJson(res, 200, {
      ok: true,
      collector,
    });
  }

  if (method === "DELETE" && pathname.startsWith("/v1/config/log-collectors/")) {
    const suffix = pathname.replace("/v1/config/log-collectors/", "");
    if (suffix && !suffix.includes("/")) {
      const collectorKey = decodeURIComponent(suffix);
      const deleted = await store.deleteLogCollector(collectorKey);
      if (!deleted) {
        return sendJson(res, 404, {
          ok: false,
          errorCode: "ERR-1003",
          error: "Collector not found",
        });
      }
      await writeAuditLog(store, req, {
        entityType: "log_collector",
        entityId: collectorKey,
        action: "config.log_collector.delete",
        metadata: {},
      });
      return sendJson(res, 200, {
        ok: true,
        collectorKey,
        deleted: true,
      });
    }
  }

  if (method === "POST" && pathname.startsWith("/v1/config/log-collectors/") && pathname.endsWith("/run")) {
    const collectorKey = decodeURIComponent(pathname.replace("/v1/config/log-collectors/", "").replace("/run", ""));
    try {
      const result = await collectorEngine.runCollector(collectorKey, { trigger: "manual" });
      return sendJson(res, 200, {
        ok: true,
        collectorKey,
        result,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return sendJson(res, statusCode, {
        ok: false,
        collectorKey,
        error: error.message || "Collector run failed",
        run: error.run || null,
      });
    }
  }

  if (method === "GET" && pathname === "/v1/log-collector-runs") {
    const runs = store.listCollectorRuns({
      collectorKey: url.searchParams.get("collectorKey") || undefined,
      status: url.searchParams.get("status") || undefined,
      limit: asInt(url.searchParams.get("limit"), 200),
    });
    return sendJson(res, 200, {
      ok: true,
      count: runs.length,
      runs,
    });
  }

  if (method === "GET" && pathname === "/v1/system/collectors/state") {
    return sendJson(res, 200, {
      ok: true,
      scheduler: collectorEngine.snapshot(),
    });
  }

  if (method === "GET" && pathname === "/v1/issues") {
    const issues = store.listIssues({
      projectKey: url.searchParams.get("projectKey") || undefined,
      status: url.searchParams.get("status") || undefined,
      sourceType: url.searchParams.get("sourceType") || undefined,
      limit: asInt(url.searchParams.get("limit"), 200),
    });

    return sendJson(res, 200, {
      ok: true,
      count: issues.length,
      issues,
    });
  }

  if (method === "GET" && pathname.startsWith("/v1/issues/")) {
    const suffix = pathname.replace("/v1/issues/", "");
    if (suffix && !suffix.includes("/")) {
      const issueId = decodeURIComponent(suffix);
      const issue = store.getIssueById(issueId);
      if (!issue) {
        return sendJson(res, 404, {
          ok: false,
          errorCode: "ERR-1003",
          error: "Issue not found",
        });
      }

      const timeline = issue.traceId
        ? store.listLogs({
            traceId: issue.traceId,
            limit: 200,
          })
        : [];

      return sendJson(res, 200, {
        ok: true,
        issue,
        timeline,
      });
    }
  }

  if (method === "POST" && pathname === "/v1/events") {
    const body = await readJsonBody(req);
    const eventPayload = validateEventIngestPayload(body);
    const idempotencyKey = normalizeHeaderValue(req.headers["idempotency-key"]).trim();
    const requestHash = payloadHash(eventPayload);

    const idempotencyStatus = store.checkIdempotencyKey(idempotencyKey, requestHash);
    if (idempotencyStatus.status === "conflict") {
      await writeAuditLog(store, req, {
        entityType: "event",
        entityId: eventPayload.eventId,
        action: "event.idempotency_conflict",
        metadata: {
          issueId: idempotencyStatus.issueId || null,
          idempotencyKey: idempotencyKey || null,
        },
      });
      return sendJson(res, 400, {
        ok: false,
        errorCode: "ERR-1002",
        error: "Idempotency key conflicts with different request payload",
        issueId: idempotencyStatus.issueId || null,
      });
    }
    if (idempotencyStatus.status === "replay") {
      await writeAuditLog(store, req, {
        entityType: "event",
        entityId: eventPayload.eventId,
        action: "event.idempotency_replay",
        metadata: {
          issueId: idempotencyStatus.issueId || null,
          idempotencyKey: idempotencyKey || null,
        },
      });
      return sendJson(res, 202, {
        ok: true,
        issueId: idempotencyStatus.issueId,
        deduplicated: true,
        idempotencyReplayed: true,
      });
    }

    const issueResult = await store.createOrGetIssueFromEvent(eventPayload);

    if (!issueResult.deduplicated) {
      const eventLog = buildEventIngestLog(eventPayload, req);
      await store.addLog(eventLog);
    }

    if (idempotencyKey) {
      await store.bindIdempotencyKey(idempotencyKey, requestHash, issueResult.issue.id);
    }

    await writeAuditLog(store, req, {
      entityType: "issue",
      entityId: issueResult.issue.id,
      action: issueResult.deduplicated ? "issue.deduplicated" : "issue.created",
      metadata: {
        projectKey: issueResult.issue.projectKey,
        eventId: issueResult.issue.eventId,
        sourceType: issueResult.issue.sourceType,
      },
    });
    publishQueueEvent(queueBroker, routeContext, {
      topic: "ops.events.issue.lifecycle",
      eventType: issueResult.deduplicated ? "issue.deduplicated" : "issue.created",
      eventVersion: "v1",
      correlationId: issueResult.issue.id,
      payload: {
        issueId: issueResult.issue.id,
        projectKey: issueResult.issue.projectKey,
        eventId: issueResult.issue.eventId,
        sourceType: issueResult.issue.sourceType,
        deduplicated: issueResult.deduplicated,
      },
    });

    return sendJson(res, 202, {
      ok: true,
      issueId: issueResult.issue.id,
      deduplicated: issueResult.deduplicated,
    });
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
    const projectKey = url.searchParams.get("projectKey") || undefined;
    return sendJson(res, 200, {
      ok: true,
      services: store.listServices({ projectKey }),
    });
  }

  if (method === "GET" && pathname.startsWith("/v1/traces/")) {
    const traceId = decodeURIComponent(pathname.replace("/v1/traces/", ""));
    const projectKey = url.searchParams.get("projectKey") || undefined;
    const logs = store.getTrace(traceId, { projectKey });
    return sendJson(res, 200, {
      ok: true,
      traceId,
      count: logs.length,
      logs,
    });
  }

  if (method === "GET" && pathname === "/v1/traces") {
    const projectKey = url.searchParams.get("projectKey") || undefined;
    const traces = store.listTraceSummaries({
      limit: asInt(url.searchParams.get("limit"), 50),
      status: url.searchParams.get("status") || undefined,
      service: url.searchParams.get("service") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      keyword: url.searchParams.get("keyword") || undefined,
      projectKey,
    });

    return sendJson(res, 200, {
      ok: true,
      count: traces.length,
      traces,
    });
  }

  if (method === "GET" && pathname === "/v1/logs") {
    const projectKey = url.searchParams.get("projectKey") || undefined;
    const logs = store.listLogs({
      traceId: url.searchParams.get("traceId") || undefined,
      level: url.searchParams.get("level") || undefined,
      service: url.searchParams.get("service") || undefined,
      projectKey,
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
    const projectKey = body.projectKey ? String(body.projectKey) : undefined;
    const result = analyzeExceptionLogs(store.listLogs({ limit: 20000, projectKey }), {
      since: body.since,
    });
    await store.saveAnalysisResult(result);
    return sendJson(res, 200, {
      ok: true,
      projectKey: projectKey || null,
      generatedAt: result.generatedAt,
      totalErrorLogs: result.totalErrorLogs,
      bugCount: result.bugReports.length,
      bugReports: result.bugReports,
    });
  }

  if (method === "GET" && pathname === "/v1/bugs") {
    const projectKey = url.searchParams.get("projectKey") || undefined;
    const bugs = store.listBugs({
      status: url.searchParams.get("status") || undefined,
      severity: url.searchParams.get("severity") || undefined,
      projectKey,
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
    const projectKey = url.searchParams.get("projectKey") || undefined;
    const tasks = store.listRepairTasks({
      status: url.searchParams.get("status") || undefined,
      severity: url.searchParams.get("severity") || undefined,
      projectKey,
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
    const projectKey = url.searchParams.get("projectKey") || undefined;
    return sendJson(res, 200, { ok: true, overview: store.getOverview({ minutes: 60, projectKey }) });
  }

  if (method === "GET" && pathname === "/v1/dashboard/error-trend") {
    const projectKey = url.searchParams.get("projectKey") || undefined;
    return sendJson(res, 200, {
      ok: true,
      points: store.getErrorTrend({
        hours: asInt(url.searchParams.get("hours"), 24),
        bucketMinutes: asInt(url.searchParams.get("bucketMinutes"), 60),
        projectKey,
      }),
    });
  }

  if (method === "GET" && pathname === "/v1/dashboard/services") {
    const projectKey = url.searchParams.get("projectKey") || undefined;
    return sendJson(res, 200, {
      ok: true,
      services: store.getServiceOverview({ minutes: asInt(url.searchParams.get("minutes"), 60), projectKey }),
    });
  }

  if (method === "GET" && pathname === "/v1/dashboard/top-errors") {
    const projectKey = url.searchParams.get("projectKey") || undefined;
    return sendJson(res, 200, {
      ok: true,
      topErrors: store.getTopErrors({
        limit: asInt(url.searchParams.get("limit"), 10),
        hours: asInt(url.searchParams.get("hours"), 24),
        projectKey,
      }),
    });
  }

  if (method === "GET" && pathname === "/v1/dashboard/full") {
    const projectKey = url.searchParams.get("projectKey") || undefined;
    return sendJson(res, 200, { ok: true, ...dashboardPayload(store, scheduler, { projectKey }) });
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
    queueBroker.reset();
    await writeAuditLog(store, req, {
      entityType: "system",
      entityId: "trace-log-platform",
      action: "system.reset",
      metadata: { confirmed: true },
      operatorType: "human",
    });
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
  enableSqliteAudit = process.env.ENABLE_SQLITE_AUDIT === "1",
  auditDbPath = process.env.AUDIT_DB_PATH || DEFAULT_AUDIT_DB_FILE,
  queueMaxAttempts = DEFAULT_QUEUE_MAX_ATTEMPTS,
  enableAutoAnalyze = process.env.AUTO_ANALYZE !== "0",
  analyzeIntervalMs = asInt(process.env.ANALYZE_INTERVAL_MS, 30000),
  enableCollectorScheduler = process.env.ENABLE_LOG_COLLECTOR_SCHEDULER !== "0",
  collectorTickIntervalMs = asInt(process.env.LOG_COLLECTOR_TICK_INTERVAL_MS, 5000),
  packageCatalogFilePath = process.env.PACKAGE_CATALOG_FILE || DEFAULT_PACKAGE_CATALOG_FILE,
} = {}) {
  const auditSink = enableSqliteAudit ? new SqliteAuditSink(auditDbPath) : null;
  if (auditSink) {
    await auditSink.init();
  }

  const store = new FileBackedStore(dataFilePath, { auditSink });
  await store.init();
  const queueBroker = new InMemoryTopicQueue({ maxAttempts: queueMaxAttempts });

  const scheduler = new AnalysisScheduler({
    store,
    intervalMs: analyzeIntervalMs,
    minErrorCount: 1,
    maxAnalyzeLogs: 20000,
  });

  const collectorEngine = new LogCollectorEngine({
    store,
    tickIntervalMs: collectorTickIntervalMs,
  });

  if (enableAutoAnalyze) {
    scheduler.start();
  }
  if (enableCollectorScheduler) {
    collectorEngine.start();
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

      const result = await handleApiRoute(
        req,
        res,
        store,
        routeContext,
        scheduler,
        queueBroker,
        collectorEngine,
        packageCatalogFilePath,
      );
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
        errorCode: error.errorCode || null,
        error: error.message || "Internal Server Error",
      });
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));

  return {
    server,
    store,
    queueBroker,
    scheduler,
    collectorEngine,
    port: server.address().port,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((err) => {
          scheduler.stop();
          collectorEngine.stop();
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
