import { api } from "./api.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toCsv(value) {
  if (!value) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeParseJson(raw, fallback = {}) {
  const text = String(raw || "").trim();
  if (!text) {
    return fallback;
  }
  return JSON.parse(text);
}

function updateModeFields(mode) {
  const map = {
    local: document.getElementById("collector-mode-local"),
    command: document.getElementById("collector-mode-command"),
    journald: document.getElementById("collector-mode-journald"),
    oss: document.getElementById("collector-mode-oss"),
    syslog: document.getElementById("collector-mode-syslog"),
  };
  map.local.style.display = mode === "local_file" ? "grid" : "none";
  map.command.style.display = mode === "command_pull" ? "grid" : "none";
  map.journald.style.display = mode === "journald" ? "grid" : "none";
  map.oss.style.display = mode === "oss_pull" ? "grid" : "none";
  map.syslog.style.display = mode === "syslog_http" ? "grid" : "none";
}

function sourceSummary(item) {
  const source = item.source || {};
  switch (item.mode) {
    case "command_pull":
      return source.command || "-";
    case "journald":
      return source.command || `单元=${source.unit || "-"}`;
    case "oss_pull":
      return source.objectUrl || "-";
    case "syslog_http":
      return "POST /v1/logs/syslog（需 x-collector-key）";
    case "local_file":
    default:
      return `${source.filePath || "-"}（最大读取=${source.maxReadBytes || 1048576}）`;
  }
}

function fillCollectorForm(item) {
  const source = item.source || {};
  const parse = item.parse || {};
  const options = item.options || {};

  document.getElementById("collector-key").value = item.collectorKey || "";
  document.getElementById("collector-project").value = item.projectKey || "";
  document.getElementById("collector-service").value = item.service || "";
  document.getElementById("collector-mode").value = item.mode || "local_file";
  document.getElementById("collector-enabled").checked = Boolean(item.enabled);
  document.getElementById("collector-poll-interval").value = String(item.pollIntervalSec || 30);

  document.getElementById("collector-file-path").value = source.filePath || "";
  document.getElementById("collector-from-end").checked = Boolean(source.fromEndOnFirstRun ?? source.fromEnd);
  document.getElementById("collector-max-read-bytes").value = String(source.maxReadBytes || 1048576);
  document.getElementById("collector-command").value = source.command || "";
  document.getElementById("collector-command-timeout").value = String(source.timeoutMs || 15000);

  document.getElementById("collector-journal-unit").value = source.unit || "";
  document.getElementById("collector-journal-since").value = source.since || "10 minutes ago";
  document.getElementById("collector-journal-lines").value = String(source.lines || 500);
  document.getElementById("collector-journal-timeout").value = String(source.timeoutMs || 15000);
  document.getElementById("collector-journal-command").value = source.command || "";

  document.getElementById("collector-oss-url").value = source.objectUrl || "";
  document.getElementById("collector-oss-timeout").value = String(source.timeoutMs || 20000);
  document.getElementById("collector-oss-max-read-bytes").value = String(source.maxReadBytes || 1048576);
  document.getElementById("collector-oss-headers").value = source.headers ? JSON.stringify(source.headers, null, 2) : "";

  document.getElementById("collector-syslog-token").value = source.token || "";
  document.getElementById("collector-max-lines-push").value = String(options.maxLinesPerPush || 2000);

  document.getElementById("collector-parse-format").value = parse.format || "auto";
  document.getElementById("collector-level-field").value = parse.levelField || "level";
  document.getElementById("collector-message-field").value = parse.messageField || "message";
  document.getElementById("collector-time-field").value = parse.timestampField || "timestamp";
  document.getElementById("collector-trace-field").value = parse.traceIdField || "traceId";

  document.getElementById("collector-max-lines").value = String(options.maxLinesPerRun || 500);
  document.getElementById("collector-include-patterns").value = toCsv(options.includePatterns);
  document.getElementById("collector-exclude-patterns").value = toCsv(options.excludePatterns);
  document.getElementById("collector-tags").value = toCsv(item.tags);
  document.getElementById("collector-static-meta").value = options.staticMeta
    ? JSON.stringify(options.staticMeta, null, 2)
    : "";

  updateModeFields(item.mode || "local_file");
}

function readCollectorForm() {
  const mode = document.getElementById("collector-mode").value;
  const staticMeta = safeParseJson(document.getElementById("collector-static-meta").value, {});

  const payload = {
    collectorKey: document.getElementById("collector-key").value.trim(),
    projectKey: document.getElementById("collector-project").value.trim(),
    service: document.getElementById("collector-service").value.trim(),
    mode,
    enabled: document.getElementById("collector-enabled").checked,
    pollIntervalSec: Number(document.getElementById("collector-poll-interval").value || 30),
    parse: {
      format: document.getElementById("collector-parse-format").value.trim() || "auto",
      levelField: document.getElementById("collector-level-field").value.trim() || "level",
      messageField: document.getElementById("collector-message-field").value.trim() || "message",
      timestampField: document.getElementById("collector-time-field").value.trim() || "timestamp",
      traceIdField: document.getElementById("collector-trace-field").value.trim() || "traceId",
    },
    options: {
      maxLinesPerRun: Number(document.getElementById("collector-max-lines").value || 500),
      maxLinesPerPush: Number(document.getElementById("collector-max-lines-push").value || 2000),
      includePatterns: parseCsv(document.getElementById("collector-include-patterns").value),
      excludePatterns: parseCsv(document.getElementById("collector-exclude-patterns").value),
      staticMeta,
    },
    tags: parseCsv(document.getElementById("collector-tags").value),
  };

  if (mode === "local_file") {
    payload.source = {
      filePath: document.getElementById("collector-file-path").value.trim(),
      fromEndOnFirstRun: document.getElementById("collector-from-end").checked,
      maxReadBytes: Number(document.getElementById("collector-max-read-bytes").value || 1048576),
    };
  } else if (mode === "command_pull") {
    payload.source = {
      command: document.getElementById("collector-command").value.trim(),
      timeoutMs: Number(document.getElementById("collector-command-timeout").value || 15000),
    };
  } else if (mode === "journald") {
    payload.source = {
      unit: document.getElementById("collector-journal-unit").value.trim(),
      since: document.getElementById("collector-journal-since").value.trim() || "10 minutes ago",
      lines: Number(document.getElementById("collector-journal-lines").value || 500),
      timeoutMs: Number(document.getElementById("collector-journal-timeout").value || 15000),
      command: document.getElementById("collector-journal-command").value.trim() || undefined,
    };
  } else if (mode === "oss_pull") {
    payload.source = {
      objectUrl: document.getElementById("collector-oss-url").value.trim(),
      timeoutMs: Number(document.getElementById("collector-oss-timeout").value || 20000),
      maxReadBytes: Number(document.getElementById("collector-oss-max-read-bytes").value || 1048576),
      headers: safeParseJson(document.getElementById("collector-oss-headers").value, {}),
    };
  } else if (mode === "syslog_http") {
    payload.source = {
      token: document.getElementById("collector-syslog-token").value.trim() || undefined,
    };
  }

  return payload;
}

function renderCollectors(collectors, onAction) {
  const container = document.getElementById("collector-list");
  if (!collectors || collectors.length === 0) {
    container.innerHTML = '<div class="list-item">暂无采集配置</div>';
    return;
  }

  container.innerHTML = collectors
    .map((item) => {
      const statusBadge = item.enabled ? "badge-healthy" : "badge-failed";
      const runStatus = item.state?.lastStatus || "unknown";
      const runBadge = runStatus === "success" ? "badge-healthy" : runStatus === "failed" ? "badge-failed" : "badge-in_progress";
      const modeMap = {
        local_file: "本地文件",
        command_pull: "命令拉取",
        journald: "Journald",
        oss_pull: "对象存储拉取",
        syslog_http: "Syslog HTTP",
      };
      const runStatusMap = {
        success: "成功",
        failed: "失败",
        unknown: "未知",
      };
      return `<div class="list-item collector-card">
        <div class="item-title">${escapeHtml(item.collectorKey)}</div>
        <div class="collector-meta-grid">
          <div><strong>系统</strong>：${escapeHtml(item.projectKey)}</div>
          <div><strong>服务</strong>：${escapeHtml(item.service)}</div>
          <div><strong>模式</strong>：${escapeHtml(modeMap[item.mode] || item.mode)}</div>
          <div><strong>间隔</strong>：${escapeHtml(String(item.pollIntervalSec || 30))}秒</div>
          <div><strong>来源</strong>：<code>${escapeHtml(sourceSummary(item))}</code></div>
          <div><strong>启用状态</strong>：<span class="badge ${statusBadge}">${item.enabled ? "启用" : "禁用"}</span></div>
          <div><strong>最近执行</strong>：${escapeHtml(item.state?.lastRunAt || "-")}</div>
          <div><strong>最近结果</strong>：<span class="badge ${runBadge}">${escapeHtml(runStatusMap[runStatus] || runStatus)}</span></div>
        </div>
        <div class="toolbar">
          <button class="btn btn-secondary collector-btn-edit" data-key="${escapeHtml(item.collectorKey)}">编辑</button>
          <button class="btn btn-primary collector-btn-run" data-key="${escapeHtml(item.collectorKey)}" ${
            item.mode === "syslog_http" ? "disabled" : ""
          }>立即执行</button>
          <button class="btn btn-warning collector-btn-delete" data-key="${escapeHtml(item.collectorKey)}">删除</button>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".collector-btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => onAction("edit", btn.dataset.key));
  });
  container.querySelectorAll(".collector-btn-run").forEach((btn) => {
    btn.addEventListener("click", () => onAction("run", btn.dataset.key));
  });
  container.querySelectorAll(".collector-btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => onAction("delete", btn.dataset.key));
  });
}

function renderRuns(runs) {
  const container = document.getElementById("collector-runs");
  if (!runs || runs.length === 0) {
    container.innerHTML = '<div class="list-item">暂无运行记录</div>';
    return;
  }

  container.innerHTML = runs
    .map((run) => {
      const badge = run.status === "success" ? "badge-healthy" : run.status === "failed" ? "badge-failed" : "badge-in_progress";
      const statusMap = {
        success: "成功",
        failed: "失败",
      };
      return `<div class="list-item">
        <div class="item-title">${escapeHtml(run.collectorKey)} · <span class="badge ${badge}">${escapeHtml(statusMap[run.status] || run.status)}</span></div>
        <div>触发方式=${escapeHtml(run.trigger || "-")} | 扫描=${escapeHtml(String(run.scannedCount || 0))} | 入库=${escapeHtml(String(run.ingestedCount || 0))}</div>
        <div>开始=${escapeHtml(run.startedAt || "-")} | 结束=${escapeHtml(run.finishedAt || "-")}</div>
        <div>${escapeHtml(run.message || "")}</div>
      </div>`;
    })
    .join("");
}

export function mountCollectorsModule(log, getScope) {
  const statusEl = document.getElementById("collector-form-status");
  const form = document.getElementById("collector-form");
  const modeSelect = document.getElementById("collector-mode");
  let cachedCollectors = [];

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.className = isError ? "collector-status error" : "collector-status";
  }

  async function refreshCollectors() {
    const scope = typeof getScope === "function" ? getScope() : {};
    const qs = new URLSearchParams();
    if (scope?.projectKey) {
      qs.set("projectKey", scope.projectKey);
    }
    const path = qs.toString() ? `/v1/config/log-collectors?${qs.toString()}` : "/v1/config/log-collectors";
    const data = await api(path);
    cachedCollectors = data.collectors || [];
    renderCollectors(cachedCollectors, async (action, collectorKey) => {
      if (action === "edit") {
        const found = cachedCollectors.find((item) => item.collectorKey === collectorKey);
        if (found) {
          fillCollectorForm(found);
          setStatus(`已加载配置 ${collectorKey}`);
        }
        return;
      }

      if (action === "run") {
        try {
          setStatus(`正在执行 ${collectorKey} ...`);
          const result = await api(`/v1/config/log-collectors/${encodeURIComponent(collectorKey)}/run`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
          await Promise.all([refreshCollectors(), refreshRuns()]);
          setStatus(`执行完成: ${collectorKey}`);
          log("采集执行完成", result);
        } catch (error) {
          setStatus(`执行失败: ${collectorKey} (${error.message})`, true);
          log("采集执行失败", error.message);
        }
        return;
      }

      if (action === "delete") {
        const sure = window.confirm(`确认删除采集器 ${collectorKey} ?`);
        if (!sure) {
          return;
        }
        try {
          await api(`/v1/config/log-collectors/${encodeURIComponent(collectorKey)}`, { method: "DELETE" });
          await Promise.all([refreshCollectors(), refreshRuns()]);
          setStatus(`已删除: ${collectorKey}`);
        } catch (error) {
          setStatus(`删除失败: ${collectorKey} (${error.message})`, true);
        }
      }
    });
  }

  async function refreshRuns() {
    const data = await api("/v1/log-collector-runs?limit=20");
    renderRuns(data.runs || []);
  }

  async function refresh() {
    await Promise.all([refreshCollectors(), refreshRuns()]);
  }

  modeSelect.addEventListener("change", () => {
    updateModeFields(modeSelect.value);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = readCollectorForm();
      const scope = typeof getScope === "function" ? getScope() : {};
      if (!payload.projectKey && scope?.projectKey) {
        payload.projectKey = scope.projectKey;
      }
      await api("/v1/config/log-collectors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refresh();
      setStatus(`配置已保存: ${payload.collectorKey}`);
      log("采集配置已保存", payload.collectorKey);
    } catch (error) {
      setStatus(`保存失败: ${error.message}`, true);
      log("采集配置保存失败", error.message);
    }
  });

  document.getElementById("collector-form-reset").addEventListener("click", () => {
    form.reset();
    const scope = typeof getScope === "function" ? getScope() : {};
    if (scope?.projectKey) {
      document.getElementById("collector-project").value = scope.projectKey;
    }
    updateModeFields(modeSelect.value);
    setStatus("表单已重置");
  });

  document.getElementById("btn-refresh-collectors").addEventListener("click", () => {
    refresh()
      .then(() => setStatus("采集配置已刷新"))
      .catch((error) => setStatus(`刷新失败: ${error.message}`, true));
  });

  updateModeFields(modeSelect.value);
  const scope = typeof getScope === "function" ? getScope() : {};
  if (scope?.projectKey) {
    document.getElementById("collector-project").value = scope.projectKey;
  }

  return { refresh };
}
