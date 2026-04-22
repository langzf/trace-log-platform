import { promises as fs } from "node:fs";
import path from "node:path";

import { fingerprintOf } from "./analyzer.js";
import { generateId, nowIso } from "./ids.js";

const DEFAULT_STATE = {
  logs: [],
  issues: [],
  eventIssueMap: {},
  idempotencyMap: {},
  auditLogs: [],
  executors: [],
  projects: [],
  modelPolicies: [],
  bugs: [],
  repairTasks: [],
  stats: {
    totalLogs: 0,
    totalErrors: 0,
    totalEvents: 0,
    totalAuditLogs: 0,
    analysisRuns: 0,
    updatedAt: null,
    lastAnalysisAt: null,
  },
};

const TASK_STATUS_FLOW = new Set(["pending", "in_progress", "deployed", "verified", "failed"]);
const ACTIVE_TASK_STATUS = new Set(["pending", "in_progress", "deployed"]);
const BUG_SEVERITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toTime(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateIso(ts) {
  return new Date(ts).toISOString();
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function byTimeAsc(a, b) {
  return toTime(a.timestamp) - toTime(b.timestamp);
}

function byUpdatedDesc(a, b) {
  return toTime(b.updatedAt || b.lastSeen || 0) - toTime(a.updatedAt || a.lastSeen || 0);
}

export class FileBackedStore {
  constructor(filePath, { maxLogs = 50000, auditSink = null } = {}) {
    this.filePath = filePath;
    this.maxLogs = maxLogs;
    this.auditSink = auditSink;
    this.state = clone(DEFAULT_STATE);
    this.persistPromise = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const file = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(file);
      this.state = {
        ...clone(DEFAULT_STATE),
        ...parsed,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        eventIssueMap: parsed.eventIssueMap && typeof parsed.eventIssueMap === "object" ? parsed.eventIssueMap : {},
        idempotencyMap: parsed.idempotencyMap && typeof parsed.idempotencyMap === "object" ? parsed.idempotencyMap : {},
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        executors: Array.isArray(parsed.executors) ? parsed.executors : [],
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        modelPolicies: Array.isArray(parsed.modelPolicies) ? parsed.modelPolicies : [],
        stats: {
          ...clone(DEFAULT_STATE).stats,
          ...(parsed.stats || {}),
        },
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await this.persist();
    }
  }

  persist() {
    this.state.stats.updatedAt = nowIso();
    this.persistPromise = this.persistPromise.then(() =>
      fs.writeFile(this.filePath, JSON.stringify(this.state, null, 2)),
    );
    return this.persistPromise;
  }

  enforceRetention() {
    if (this.state.logs.length <= this.maxLogs) {
      return;
    }
    const removeCount = this.state.logs.length - this.maxLogs;
    this.state.logs.splice(0, removeCount);
  }

  addLog(logEntry) {
    this.state.logs.push(logEntry);
    this.state.stats.totalLogs += 1;
    if (logEntry.level === "error" || logEntry.error) {
      this.state.stats.totalErrors += 1;
    }
    this.enforceRetention();
    return this.persist();
  }

  addLogs(entries) {
    for (const entry of entries) {
      this.state.logs.push(entry);
      this.state.stats.totalLogs += 1;
      if (entry.level === "error" || entry.error) {
        this.state.stats.totalErrors += 1;
      }
    }
    this.enforceRetention();
    return this.persist();
  }

  listIssues({ projectKey, status, sourceType, limit = 200 } = {}) {
    const issues = this.state.issues
      .filter((item) => (projectKey ? item.projectKey === projectKey : true))
      .filter((item) => (status ? item.status === status : true))
      .filter((item) => (sourceType ? item.sourceType === sourceType : true))
      .sort(byUpdatedDesc);

    return clone(issues.slice(0, limit));
  }

  getIssueById(issueId) {
    const issue = this.state.issues.find((item) => item.id === issueId);
    return issue ? clone(issue) : null;
  }

  getIssueByEventId(eventId) {
    const issueId = this.state.eventIssueMap[eventId];
    if (!issueId) {
      return null;
    }
    return this.getIssueById(issueId);
  }

  checkIdempotencyKey(idempotencyKey, requestHash) {
    if (!idempotencyKey) {
      return { status: "none" };
    }

    const existing = this.state.idempotencyMap[idempotencyKey];
    if (!existing) {
      return { status: "new" };
    }

    if (existing.requestHash !== requestHash) {
      return {
        status: "conflict",
        issueId: existing.issueId || null,
      };
    }

    return {
      status: "replay",
      issueId: existing.issueId || null,
    };
  }

  async bindIdempotencyKey(idempotencyKey, requestHash, issueId) {
    if (!idempotencyKey) {
      return;
    }

    this.state.idempotencyMap[idempotencyKey] = {
      idempotencyKey,
      requestHash,
      issueId,
      updatedAt: nowIso(),
      createdAt: this.state.idempotencyMap[idempotencyKey]?.createdAt || nowIso(),
    };

    await this.persist();
  }

  async createOrGetIssueFromEvent(eventPayload) {
    const existingIssueId = this.state.eventIssueMap[eventPayload.eventId];
    if (existingIssueId) {
      const existing = this.state.issues.find((item) => item.id === existingIssueId);
      if (existing) {
        existing.updatedAt = nowIso();
        await this.persist();
        return { issue: clone(existing), deduplicated: true };
      }
    }

    const issue = {
      id: generateId("issue_", 8),
      issueKey: `evt:${eventPayload.eventId}`,
      projectKey: eventPayload.projectKey,
      eventId: eventPayload.eventId,
      sourceType: eventPayload.sourceType,
      traceId: eventPayload.traceId || null,
      sessionId: eventPayload.sessionId || null,
      userId: eventPayload.userId || null,
      category: "untriaged",
      subcategory: null,
      priority: "P3",
      status: "new",
      payload: clone(eventPayload.payload || {}),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.state.issues.push(issue);
    this.state.eventIssueMap[eventPayload.eventId] = issue.id;
    this.state.stats.totalEvents += 1;
    await this.persist();

    return { issue: clone(issue), deduplicated: false };
  }

  async addAuditLog(entry) {
    const payload = {
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      operatorType: entry.operatorType,
      operatorId: entry.operatorId,
      metadata: clone(entry.metadata || {}),
      createdAt: entry.createdAt || nowIso(),
    };

    this.state.auditLogs.push(payload);
    this.state.stats.totalAuditLogs += 1;
    await this.persist();

    if (this.auditSink && typeof this.auditSink.write === "function") {
      await this.auditSink.write(payload);
    }

    return clone(payload);
  }

  listAuditLogs({ entityType, entityId, action, operatorType, limit = 200 } = {}) {
    const items = this.state.auditLogs
      .filter((item) => (entityType ? item.entityType === entityType : true))
      .filter((item) => (entityId ? item.entityId === entityId : true))
      .filter((item) => (action ? item.action === action : true))
      .filter((item) => (operatorType ? item.operatorType === operatorType : true))
      .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

    return clone(items.slice(0, limit));
  }

  listExecutors({ enabled, kind, limit = 200 } = {}) {
    const executors = this.state.executors
      .filter((item) => (enabled === undefined ? true : item.enabled === enabled))
      .filter((item) => (kind ? item.kind === kind : true))
      .sort((a, b) => {
        const aPriority = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 100;
        const bPriority = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 100;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return byUpdatedDesc(a, b);
      });
    return clone(executors.slice(0, limit));
  }

  async upsertExecutor(profile) {
    const now = nowIso();
    const idx = this.state.executors.findIndex((item) => item.executorKey === profile.executorKey);
    const current = idx >= 0 ? this.state.executors[idx] : null;
    const next = {
      executorKey: profile.executorKey,
      kind: profile.kind || current?.kind || "codex",
      endpoint: profile.endpoint,
      enabled: profile.enabled ?? current?.enabled ?? true,
      priority: Number.isFinite(Number(profile.priority)) ? Number(profile.priority) : (current?.priority ?? 100),
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };

    if (idx >= 0) {
      this.state.executors[idx] = next;
    } else {
      this.state.executors.push(next);
    }

    await this.persist();
    return clone(next);
  }

  listProjects({ status, limit = 200 } = {}) {
    const projects = this.state.projects
      .filter((item) => (status ? item.status === status : true))
      .sort(byUpdatedDesc);
    return clone(projects.slice(0, limit));
  }

  async upsertProject(profile) {
    const now = nowIso();
    const idx = this.state.projects.findIndex((item) => item.projectKey === profile.projectKey);
    const current = idx >= 0 ? this.state.projects[idx] : null;
    const next = {
      projectKey: profile.projectKey,
      repoUrl: profile.repoUrl,
      defaultBranch: profile.defaultBranch || current?.defaultBranch || "main",
      status: profile.status || current?.status || "active",
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };

    if (idx >= 0) {
      this.state.projects[idx] = next;
    } else {
      this.state.projects.push(next);
    }

    await this.persist();
    return clone(next);
  }

  listModelPolicies({ projectKey, defaultModelTier, limit = 200 } = {}) {
    const items = this.state.modelPolicies
      .filter((item) => (projectKey ? item.projectKey === projectKey : true))
      .filter((item) => (defaultModelTier ? item.defaultModelTier === defaultModelTier : true))
      .sort(byUpdatedDesc);
    return clone(items.slice(0, limit));
  }

  async upsertModelPolicy(policy) {
    const now = nowIso();
    const idx = this.state.modelPolicies.findIndex(
      (item) => item.projectKey === policy.projectKey && item.policyName === (policy.policyName || "default"),
    );
    const current = idx >= 0 ? this.state.modelPolicies[idx] : null;
    const next = {
      projectKey: policy.projectKey,
      policyName: policy.policyName || current?.policyName || "default",
      defaultModelTier: policy.defaultModelTier || current?.defaultModelTier || "performance",
      upgradeRules:
        policy.upgradeRules && typeof policy.upgradeRules === "object" && !Array.isArray(policy.upgradeRules)
          ? clone(policy.upgradeRules)
          : clone(current?.upgradeRules || {}),
      budgetDailyTokens: Number.isFinite(Number(policy.budgetDailyTokens))
        ? Number(policy.budgetDailyTokens)
        : (current?.budgetDailyTokens ?? 0),
      budgetTaskTokens: Number.isFinite(Number(policy.budgetTaskTokens))
        ? Number(policy.budgetTaskTokens)
        : (current?.budgetTaskTokens ?? 0),
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };

    if (idx >= 0) {
      this.state.modelPolicies[idx] = next;
    } else {
      this.state.modelPolicies.push(next);
    }

    await this.persist();
    return clone(next);
  }

  listLogs({
    limit = 200,
    level,
    traceId,
    service,
    source,
    from,
    to,
    keyword,
  } = {}) {
    const fromTs = from ? toTime(from) : null;
    const toTs = to ? toTime(to) : null;
    const kw = keyword ? String(keyword).toLowerCase() : null;

    const logs = this.state.logs
      .filter((log) => (level ? log.level === level : true))
      .filter((log) => (traceId ? log.traceId === traceId : true))
      .filter((log) => (service ? log.service === service : true))
      .filter((log) => (source ? log.source === source : true))
      .filter((log) => {
        if (!fromTs && !toTs) {
          return true;
        }
        const ts = toTime(log.timestamp);
        if (fromTs && ts < fromTs) {
          return false;
        }
        if (toTs && ts > toTs) {
          return false;
        }
        return true;
      })
      .filter((log) => {
        if (!kw) {
          return true;
        }
        const text = `${log.message || ""} ${log.error?.message || ""} ${JSON.stringify(log.meta || {})}`.toLowerCase();
        return text.includes(kw);
      });

    return logs.slice(-limit);
  }

  listServices() {
    return [...new Set(this.state.logs.map((log) => log.service).filter(Boolean))].sort();
  }

  getTrace(traceId) {
    return this.state.logs.filter((log) => log.traceId === traceId).sort(byTimeAsc);
  }

  listTraceSummaries({ limit = 50, service, status, from, to, keyword } = {}) {
    const logs = this.listLogs({ limit: this.maxLogs, service, from, to, keyword });
    const grouped = new Map();

    for (const log of logs) {
      if (!log.traceId) {
        continue;
      }
      if (!grouped.has(log.traceId)) {
        grouped.set(log.traceId, []);
      }
      grouped.get(log.traceId).push(log);
    }

    const rows = [];
    for (const [traceId, records] of grouped.entries()) {
      const sorted = records.sort(byTimeAsc);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const errorCount = sorted.filter((item) => item.level === "error" || item.error).length;
      const summary = {
        traceId,
        startedAt: first.timestamp,
        endedAt: last.timestamp,
        durationMs: Math.max(0, toTime(last.timestamp) - toTime(first.timestamp)),
        service: first.service,
        source: first.source,
        logCount: sorted.length,
        errorCount,
        status: errorCount > 0 ? "failed" : "ok",
      };

      if (status && summary.status !== status) {
        continue;
      }
      rows.push(summary);
    }

    rows.sort((a, b) => toTime(b.startedAt) - toTime(a.startedAt));
    return rows.slice(0, limit);
  }

  listBugs({ status, severity } = {}) {
    const bugs = clone(this.state.bugs)
      .filter((bug) => (status ? bug.status === status : true))
      .filter((bug) => (severity ? bug.severity === severity : true));
    bugs.sort(byUpdatedDesc);
    return bugs;
  }

  getBugById(bugId) {
    const bug = this.state.bugs.find((item) => item.id === bugId);
    return bug ? clone(bug) : null;
  }

  listRepairTasks({ status, severity } = {}) {
    const bugMap = new Map(this.state.bugs.map((bug) => [bug.id, bug]));
    const tasks = clone(this.state.repairTasks)
      .filter((task) => (status ? task.status === status : true))
      .filter((task) => {
        if (!severity) {
          return true;
        }
        const bug = bugMap.get(task.bugId);
        return bug?.severity === severity;
      });
    tasks.sort(byUpdatedDesc);
    return tasks;
  }

  saveAnalysisResult({ bugReports, generatedAt }) {
    const fingerprintToBug = new Map(this.state.bugs.map((bug) => [bug.fingerprint, bug]));

    for (const report of bugReports) {
      const existing = fingerprintToBug.get(report.fingerprint);
      if (existing) {
        existing.title = report.title;
        existing.summary = report.summary;
        existing.severity = report.severity;
        existing.lastSeen = report.lastSeen;
        existing.count = report.count;
        existing.sampleLogIds = report.sampleLogIds;
        existing.traceIds = report.traceIds;
        existing.recommendations = report.recommendations;
        existing.rootCauseHypothesis = report.rootCauseHypothesis;
        existing.updatedAt = nowIso();
      } else {
        this.state.bugs.push({
          id: generateId("bug_", 6),
          status: "open",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          ...report,
        });
      }
    }

    this.state.stats.analysisRuns += 1;
    this.state.stats.lastAnalysisAt = generatedAt;
    this.refreshRepairTasks();
    return this.persist();
  }

  refreshRepairTasks() {
    for (const bug of this.state.bugs.filter((item) => item.status === "open")) {
      const existing = this.state.repairTasks.find(
        (task) => task.bugId === bug.id && ACTIVE_TASK_STATUS.has(task.status),
      );

      if (existing) {
        existing.updatedAt = nowIso();
        existing.priority = BUG_SEVERITY_WEIGHT[bug.severity] || 1;
        existing.payload = {
          bugId: bug.id,
          fingerprint: bug.fingerprint,
          title: bug.title,
          summary: bug.summary,
          severity: bug.severity,
          rootCauseHypothesis: bug.rootCauseHypothesis,
          recommendations: bug.recommendations,
          traceIds: bug.traceIds,
          sampleLogIds: bug.sampleLogIds,
        };
        continue;
      }

      this.state.repairTasks.push({
        id: generateId("task_", 6),
        bugId: bug.id,
        status: "pending",
        priority: BUG_SEVERITY_WEIGHT[bug.severity] || 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        assignee: null,
        payload: {
          bugId: bug.id,
          fingerprint: bug.fingerprint,
          title: bug.title,
          summary: bug.summary,
          severity: bug.severity,
          rootCauseHypothesis: bug.rootCauseHypothesis,
          recommendations: bug.recommendations,
          traceIds: bug.traceIds,
          sampleLogIds: bug.sampleLogIds,
        },
      });
    }
  }

  claimRepairTask(taskId, assignee) {
    const task = this.state.repairTasks.find((item) => item.id === taskId);
    if (!task) {
      return null;
    }
    if (task.status !== "pending") {
      return { error: "Task is not pending", task: clone(task) };
    }

    task.status = "in_progress";
    task.assignee = assignee || "unknown-worker";
    task.updatedAt = nowIso();
    this.persist();
    return { task: clone(task) };
  }

  updateRepairTask(taskId, { status, note, assignee }) {
    const task = this.state.repairTasks.find((item) => item.id === taskId);
    if (!task) {
      return null;
    }

    if (status) {
      if (!TASK_STATUS_FLOW.has(status)) {
        return { error: `Invalid status: ${status}` };
      }
      task.status = status;
      task.updatedAt = nowIso();
    }

    if (note) {
      task.note = note;
      task.updatedAt = nowIso();
    }

    if (assignee) {
      task.assignee = assignee;
      task.updatedAt = nowIso();
    }

    if (status === "verified") {
      const bug = this.state.bugs.find((item) => item.id === task.bugId);
      if (bug) {
        bug.status = "fixed";
        bug.updatedAt = nowIso();
      }
    }

    if (status === "failed") {
      const bug = this.state.bugs.find((item) => item.id === task.bugId);
      if (bug) {
        bug.status = "open";
        bug.updatedAt = nowIso();
      }
    }

    this.persist();
    return { task: clone(task) };
  }

  getErrorTrend({ hours = 24, bucketMinutes = 60 } = {}) {
    const now = Date.now();
    const start = now - hours * 60 * 60 * 1000;
    const step = bucketMinutes * 60 * 1000;
    const buckets = [];

    for (let ts = start; ts <= now; ts += step) {
      buckets.push({
        ts,
        time: toDateIso(ts),
        total: 0,
        errors: 0,
      });
    }

    for (const log of this.state.logs) {
      const ts = toTime(log.timestamp);
      if (ts < start || ts > now) {
        continue;
      }
      const idx = Math.min(buckets.length - 1, Math.floor((ts - start) / step));
      if (idx < 0 || idx >= buckets.length) {
        continue;
      }
      buckets[idx].total += 1;
      if (log.level === "error" || log.error) {
        buckets[idx].errors += 1;
      }
    }

    return buckets;
  }

  getServiceOverview({ minutes = 60 } = {}) {
    const now = Date.now();
    const start = now - minutes * 60 * 1000;

    const grouped = new Map();
    for (const log of this.state.logs) {
      const ts = toTime(log.timestamp);
      if (ts < start) {
        continue;
      }

      const key = log.service || "unknown-service";
      if (!grouped.has(key)) {
        grouped.set(key, {
          service: key,
          totalLogs: 0,
          errorLogs: 0,
          traces: new Set(),
          latencyMs: [],
          lastSeen: log.timestamp,
        });
      }

      const row = grouped.get(key);
      row.totalLogs += 1;
      if (log.level === "error" || log.error) {
        row.errorLogs += 1;
      }
      if (log.traceId) {
        row.traces.add(log.traceId);
      }
      if (typeof log.meta?.durationMs === "number") {
        row.latencyMs.push(log.meta.durationMs);
      }
      if (toTime(log.timestamp) > toTime(row.lastSeen)) {
        row.lastSeen = log.timestamp;
      }
    }

    const rows = [];
    for (const row of grouped.values()) {
      const p95 = percentile(row.latencyMs, 95);
      rows.push({
        service: row.service,
        totalLogs: row.totalLogs,
        errorLogs: row.errorLogs,
        errorRate: row.totalLogs > 0 ? Number((row.errorLogs / row.totalLogs).toFixed(4)) : 0,
        traceCount: row.traces.size,
        p95LatencyMs: p95,
        status: row.errorLogs > 0 ? "degraded" : "healthy",
        lastSeen: row.lastSeen,
      });
    }

    rows.sort((a, b) => b.errorLogs - a.errorLogs || b.totalLogs - a.totalLogs);
    return rows;
  }

  getTopErrors({ limit = 10, hours = 24 } = {}) {
    const now = Date.now();
    const start = now - hours * 60 * 60 * 1000;
    const grouped = new Map();

    for (const log of this.state.logs) {
      const ts = toTime(log.timestamp);
      if (ts < start || ts > now) {
        continue;
      }
      if (!(log.level === "error" || log.error)) {
        continue;
      }
      const key = fingerprintOf(log);
      if (!grouped.has(key)) {
        grouped.set(key, {
          fingerprint: key,
          count: 0,
          lastSeen: log.timestamp,
          title: `${log.error?.name || "RuntimeError"}: ${log.error?.message || log.message || "unknown"}`,
          services: new Set(),
        });
      }
      const row = grouped.get(key);
      row.count += 1;
      if (log.service) {
        row.services.add(log.service);
      }
      if (toTime(log.timestamp) > toTime(row.lastSeen)) {
        row.lastSeen = log.timestamp;
      }
    }

    const output = [...grouped.values()]
      .map((row) => ({
        fingerprint: row.fingerprint,
        title: row.title,
        count: row.count,
        lastSeen: row.lastSeen,
        services: [...row.services],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return output;
  }

  getOverview({ minutes = 60 } = {}) {
    const now = Date.now();
    const start = now - minutes * 60 * 1000;
    let total = 0;
    let errors = 0;
    const traces = new Set();
    const services = new Set();

    for (const log of this.state.logs) {
      const ts = toTime(log.timestamp);
      if (ts < start) {
        continue;
      }
      total += 1;
      if (log.level === "error" || log.error) {
        errors += 1;
      }
      if (log.traceId) {
        traces.add(log.traceId);
      }
      if (log.service) {
        services.add(log.service);
      }
    }

    const pendingTasks = this.state.repairTasks.filter((task) => task.status === "pending").length;
    const inProgressTasks = this.state.repairTasks.filter((task) => task.status === "in_progress").length;

    return {
      windowMinutes: minutes,
      logsInWindow: total,
      errorsInWindow: errors,
      errorRate: total > 0 ? Number((errors / total).toFixed(4)) : 0,
      traceCountInWindow: traces.size,
      serviceCountInWindow: services.size,
      openBugCount: this.state.bugs.filter((bug) => bug.status === "open").length,
      fixedBugCount: this.state.bugs.filter((bug) => bug.status === "fixed").length,
      pendingTasks,
      inProgressTasks,
      analysisRuns: this.state.stats.analysisRuns,
      lastAnalysisAt: this.state.stats.lastAnalysisAt || null,
    };
  }

  getStats() {
    return clone(this.state.stats);
  }

  reset() {
    this.state = clone(DEFAULT_STATE);
    return this.persist();
  }
}
