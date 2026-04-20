import { generateId, nowIso } from "./ids.js";

function normalizeMessage(input) {
  return String(input || "unknown-error")
    .toLowerCase()
    .replace(/\(reading ['"][^'"]+['"]\)/g, "(reading <prop>)")
    .replace(/['"][a-z0-9_.$-]+['"]/g, "<str>")
    .replace(/[0-9a-f]{8,}/g, "<hex>")
    .replace(/\b\d+\b/g, "<num>")
    .replace(/https?:\/\/\S+/g, "<url>")
    .trim();
}

function inferSeverity(logs) {
  const content = logs
    .map((log) => `${log.message || ""} ${(log.error && log.error.message) || ""}`)
    .join(" ")
    .toLowerCase();

  if (/cannot read properties|typeerror|referenceerror/.test(content)) {
    return "critical";
  }

  if (logs.some((log) => Number(log.statusCode) >= 500) || /panic|crash|fatal/.test(content)) {
    return "critical";
  }

  if (/timeout|econnrefused|connection|database|deadlock|out of memory/.test(content)) {
    return "high";
  }

  return "medium";
}

function inferRootCause(logs) {
  const content = logs
    .map((log) => `${log.message || ""} ${(log.error && log.error.message) || ""}`)
    .join(" ")
    .toLowerCase();

  if (/cannot read properties|undefined/.test(content)) {
    return "高概率是空值或未初始化对象访问，建议在入口参数和异步返回处增加判空与防御式编程。";
  }

  if (/timeout|econnrefused|connection/.test(content)) {
    return "高概率是外部依赖不可用或网络抖动，建议为依赖调用增加重试、熔断与降级策略。";
  }

  if (/syntaxerror|json/.test(content)) {
    return "高概率是输入数据结构不符合预期，建议对输入 JSON schema 做严格校验并记录坏样本。";
  }

  return "需要结合该 trace 的上下游日志进一步定位，当前建议先锁定首个 error 日志附近的上下文。";
}

function inferRecommendations(logs) {
  const rec = new Set([
    "将该异常纳入自动化回归用例并在发布前执行。",
    "在相关接口增加结构化错误码，便于修复系统自动归因。",
  ]);
  const content = logs
    .map((log) => `${log.message || ""} ${(log.error && log.error.message) || ""}`)
    .join(" ")
    .toLowerCase();

  if (/timeout|econnrefused|connection/.test(content)) {
    rec.add("对下游依赖添加指数退避重试，并输出重试次数到日志。");
    rec.add("补充依赖健康检查并将失败率纳入告警阈值。");
  }

  if (/cannot read properties|undefined|null/.test(content)) {
    rec.add("在关键对象访问前增加判空，并在 TypeScript/运行时层面约束必填字段。");
  }

  if (/rate limit|429/.test(content)) {
    rec.add("为高频请求增加限流和队列缓冲，避免瞬时峰值触发级联异常。");
  }

  return [...rec];
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return "UnknownError";
}

export function fingerprintOf(log) {
  const errorName = firstNonEmpty([
    log?.error?.name,
    log?.meta?.errorName,
    log?.level === "error" ? "RuntimeError" : null,
  ]);
  const message = normalizeMessage(
    firstNonEmpty([log?.error?.message, log?.message, log?.meta?.rawMessage]),
  );
  const route = log?.path || log?.meta?.route || "unknown-route";
  return `${errorName}::${message}::${route}`;
}

export function analyzeExceptionLogs(logs, options = {}) {
  const since = options.since || null;
  const candidates = logs.filter((log) => {
    if (!(log.level === "error" || log.error)) {
      return false;
    }
    if (!since) {
      return true;
    }
    return new Date(log.timestamp).getTime() >= new Date(since).getTime();
  });

  const grouped = new Map();

  for (const log of candidates) {
    const fp = fingerprintOf(log);
    if (!grouped.has(fp)) {
      grouped.set(fp, []);
    }
    grouped.get(fp).push(log);
  }

  const bugReports = [];

  for (const [fingerprint, records] of grouped.entries()) {
    const sorted = [...records].sort((a, b) =>
      String(a.timestamp).localeCompare(String(b.timestamp)),
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const traceIds = [...new Set(sorted.map((item) => item.traceId).filter(Boolean))].slice(0, 20);
    const sampleLogIds = sorted.slice(0, 10).map((item) => item.id);

    bugReports.push({
      fingerprint,
      title: `${first.error?.name || "RuntimeError"}: ${first.error?.message || first.message || "unknown"}`,
      summary: `在 ${traceIds.length} 条链路中发现 ${sorted.length} 次同类异常。`,
      severity: inferSeverity(sorted),
      firstSeen: first.timestamp,
      lastSeen: last.timestamp,
      count: sorted.length,
      traceIds,
      sampleLogIds,
      rootCauseHypothesis: inferRootCause(sorted),
      recommendations: inferRecommendations(sorted),
      generatedAt: nowIso(),
      draftBugId: generateId("draft_", 5),
    });
  }

  bugReports.sort((a, b) => b.count - a.count);

  return {
    generatedAt: nowIso(),
    totalErrorLogs: candidates.length,
    bugReports,
  };
}
