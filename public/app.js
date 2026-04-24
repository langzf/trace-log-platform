import { api } from "./modules/api.js";
import { mountBugsModule } from "./modules/bugs-view.js";
import { mountCollectorsModule } from "./modules/collectors-view.js";
import { renderDashboard } from "./modules/dashboard-view.js";
import { mountIntegrationModule } from "./modules/integration-view.js";
import { createConsoleLogger } from "./modules/logger.js";
import { mountNavigation } from "./modules/navigation.js";
import { mountTasksModule } from "./modules/tasks-view.js";
import { mountTracesModule } from "./modules/traces-view.js";
import { mountTrafficModule } from "./modules/traffic-view.js";

const sdk = window.TraceLogSDK.createClient({
  platformBaseUrl: "",
  appName: "trace-console",
  flushIntervalMs: 1500,
  batchSize: 20,
});

const logger = createConsoleLogger("console-log");

const scopeState = {
  projectKey: "",
  contexts: [],
};

function getScope() {
  return {
    projectKey: scopeState.projectKey || "",
  };
}

function withScope(path) {
  const scope = getScope();
  if (!scope.projectKey) {
    return path;
  }
  const connector = path.includes("?") ? "&" : "?";
  return `${path}${connector}projectKey=${encodeURIComponent(scope.projectKey)}`;
}

function renderScopeSummary() {
  const summaryNode = document.getElementById("scope-summary");
  if (!scopeState.projectKey) {
    summaryNode.textContent = "当前系统：全部";
    return;
  }
  const current = scopeState.contexts.find((item) => item.projectKey === scopeState.projectKey);
  const serviceCount = current?.services?.length || 0;
  summaryNode.textContent = `当前系统：${scopeState.projectKey}（服务 ${serviceCount} 个）`;
}

function renderScopeOptions() {
  const select = document.getElementById("scope-project-select");
  const currentValue = scopeState.projectKey || "";
  const options = ['<option value="">全部系统</option>'];
  scopeState.contexts.forEach((ctx) => {
    const serviceCount = Array.isArray(ctx.services) ? ctx.services.length : 0;
    options.push(`<option value="${ctx.projectKey}">${ctx.projectKey} (${serviceCount} services)</option>`);
  });
  select.innerHTML = options.join("");

  const exists = scopeState.contexts.some((ctx) => ctx.projectKey === currentValue);
  if (currentValue && !exists) {
    scopeState.projectKey = "";
  }
  select.value = scopeState.projectKey || "";
  renderScopeSummary();
}

async function refreshSystemContexts() {
  try {
    const data = await api("/v1/system/contexts?includeInactive=true");
    scopeState.contexts = Array.isArray(data.contexts) ? data.contexts : [];
  } catch (error) {
    logger.log("系统范围加载失败", error.message);
    scopeState.contexts = [];
  }
  renderScopeOptions();
}

const tracesModule = mountTracesModule(logger.log, getScope);
const bugsModule = mountBugsModule(logger.log, getScope);
const tasksModule = mountTasksModule(logger.log, getScope);
const collectorsModule = mountCollectorsModule(logger.log, getScope);
mountIntegrationModule();
mountNavigation();
mountTrafficModule({
  sdk,
  log: logger.log,
  onDataChanged: refreshAll,
});

async function refreshDashboard() {
  const data = await api(withScope("/v1/dashboard/full"));
  renderDashboard(data);
}

async function refreshAll({ reloadScopes = false } = {}) {
  if (reloadScopes) {
    await refreshSystemContexts();
  }
  await refreshDashboard();
  await Promise.allSettled([tracesModule.refresh(), bugsModule.refresh(), tasksModule.refresh(), collectorsModule.refresh()]);
}

async function runAnalyze() {
  const scope = getScope();
  const payload = {};
  if (scope.projectKey) {
    payload.projectKey = scope.projectKey;
  }

  const data = await api("/v1/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  logger.log("手动分析完成", {
    projectKey: data.projectKey,
    bugCount: data.bugCount,
    totalErrorLogs: data.totalErrorLogs,
  });
  await refreshAll();
}

async function setAnalyzer(enabled) {
  const path = enabled ? "/v1/system/analyzer/start" : "/v1/system/analyzer/stop";
  const data = await api(path, { method: "POST" });
  logger.log(enabled ? "自动分析已开启" : "自动分析已暂停", data.scheduler);
  await refreshDashboard();
}

async function resetSystem() {
  const sure = window.confirm("将清空 logs/bugs/tasks，是否继续？");
  if (!sure) {
    return;
  }

  const data = await api("/v1/system/reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: "RESET" }),
  });

  document.getElementById("trace-detail").textContent = "";
  logger.log("平台数据已清空", data);
  await refreshAll({ reloadScopes: true });
}

document.getElementById("scope-project-select").addEventListener("change", (event) => {
  scopeState.projectKey = event.target.value || "";
  renderScopeSummary();
  refreshAll().catch((error) => logger.log("系统切换刷新失败", error.message));
});

document.getElementById("btn-refresh").addEventListener("click", () => {
  refreshAll({ reloadScopes: true }).catch((error) => logger.log("刷新失败", error.message));
});

document.getElementById("btn-analyze").addEventListener("click", () => {
  runAnalyze().catch((error) => logger.log("分析失败", error.message));
});

document.getElementById("btn-start-analyzer").addEventListener("click", () => {
  setAnalyzer(true).catch((error) => logger.log("开启失败", error.message));
});

document.getElementById("btn-stop-analyzer").addEventListener("click", () => {
  setAnalyzer(false).catch((error) => logger.log("暂停失败", error.message));
});

document.getElementById("btn-reset-system").addEventListener("click", () => {
  resetSystem().catch((error) => logger.log("重置失败", error.message));
});

refreshAll({ reloadScopes: true })
  .then(() => logger.log("控制台初始化完成", "所有模块已就绪"))
  .catch((error) => logger.log("控制台初始化失败", error.message));

setInterval(() => {
  refreshDashboard().catch(() => {
    // no-op
  });
}, 15000);

window.addEventListener("beforeunload", () => {
  sdk.shutdown().catch(() => {
    // no-op
  });
});
