import { api } from "./modules/api.js";
import { renderDashboard } from "./modules/dashboard-view.js";
import { mountBugsModule } from "./modules/bugs-view.js";
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

const tracesModule = mountTracesModule(logger.log);
const bugsModule = mountBugsModule(logger.log);
const tasksModule = mountTasksModule(logger.log);
mountIntegrationModule();
mountNavigation();
mountTrafficModule({
  sdk,
  log: logger.log,
  onDataChanged: refreshAll,
});

async function refreshDashboard() {
  const data = await api("/v1/dashboard/full");
  renderDashboard(data);
}

async function refreshAll() {
  await refreshDashboard();
  await Promise.allSettled([tracesModule.refresh(), bugsModule.refresh(), tasksModule.refresh()]);
}

async function runAnalyze() {
  const data = await api("/v1/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  logger.log("手动分析完成", {
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
  await refreshAll();
}

document.getElementById("btn-refresh").addEventListener("click", () => {
  refreshAll().catch((error) => logger.log("刷新失败", error.message));
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

refreshAll()
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
