import { api } from "./api.js";

const SNIPPETS = {
  javascript: `// Node.js package (recommended)
// npm install @traceai/trace-log-sdk
import { createBackendLogClient } from "@traceai/trace-log-sdk";

const client = createBackendLogClient({
  platformBaseUrl: "https://trace.example.com",
  serviceName: "checkout-api",
});

const tracer = client.createHttpRequestTracer(req.headers);
await tracer.reportStart({ method: req.method, path: req.path });`,
  python: `# Install package
# pip install trace-log-sdk

from trace_log_sdk import TraceLogClient

client = TraceLogClient(
    base_url="https://trace.example.com",
    service_name="python-order-service",
    batch_size=30,
)

trace = client.new_trace()
client.report("info", "create_order_start", trace, path="/orders", method="POST")`,
  java: `<!-- pom.xml -->
<dependency>
  <groupId>com.traceai</groupId>
  <artifactId>trace-log-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>

# application.yml
trace:
  log:
    platform-base-url: https://trace.example.com
    service-name: java-order-service`,
  syslog: `# rsyslog: forward existing logs to Trace Platform (no app code change)
# /etc/rsyslog.d/60-trace-platform.conf
module(load="omhttp")
template(name="TraceMsgOnly" type="string" string="%msg%\\n")

if $programname == 'nginx' then {
  action(
    type="omhttp"
    server="trace.example.com"
    serverport="443"
    usehttps="on"
    restpath="/v1/logs/syslog"
    template="TraceMsgOnly"
    action.resumeretrycount="-1"
    httpheaderkey="x-collector-key"
    httpheadervalue="nginx-prod-syslog"
  )
  stop
}`,
  curl: `# Fallback only (not recommended for app integration)
curl -X POST https://trace.example.com/v1/logs/backend \\
  -H 'content-type: application/json' \\
  -d '{
    "traceId": "tr_curl_1",
    "spanId": "sp_curl_1",
    "level": "error",
    "message": "payment failed",
    "service": "payment-service"
  }'`,
};

const LANG_LABELS = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  syslog: "Syslog",
  curl: "cURL",
};

const state = {
  activeLang: "javascript",
  catalogPayload: null,
  catalogError: null,
  loading: false,
};

function switchLang(lang) {
  const snippetNode = document.getElementById("integration-snippet");
  snippetNode.textContent = SNIPPETS[lang] || SNIPPETS.javascript;

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
  });
}

function formatBytes(sizeBytes) {
  const size = Number(sizeBytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function filterPackagesByLang(payload, lang) {
  if (!payload || !Array.isArray(payload.packages)) {
    return [];
  }
  return payload.packages.filter((pkg) => String(pkg.language || "").toLowerCase() === String(lang || "").toLowerCase());
}

function renderPackageCard(pkg) {
  const card = el("article", "list-item package-card");

  const header = el("div", "package-card-head");
  const title = el("div", "item-title", `${pkg.packageName} (${pkg.version})`);
  const badge = el("span", `badge badge-${pkg.language}`, pkg.language);
  header.append(title, badge);
  card.appendChild(header);

  if (pkg.summary) {
    card.appendChild(el("p", "package-summary", pkg.summary));
  }

  const eco = el("div", "collector-meta-grid");
  eco.appendChild(el("div", "", `生态：${pkg.ecosystem}`));
  eco.appendChild(el("div", "", `构件：${pkg.files.length} 个`));
  card.appendChild(eco);

  if (Array.isArray(pkg.installCommands) && pkg.installCommands.length > 0) {
    const installTitle = el("div", "package-install-title", "安装命令");
    card.appendChild(installTitle);
    const installNode = el("pre", "console package-install");
    installNode.textContent = pkg.installCommands.join("\n");
    card.appendChild(installNode);
  }

  const filesWrap = el("div", "package-file-list");
  pkg.files.forEach((file) => {
    const row = el("div", "package-file-row");
    const left = el("div", "package-file-main");
    left.appendChild(el("div", "package-file-name", file.fileName));
    left.appendChild(el("div", "package-file-meta", `${formatBytes(file.sizeBytes)} · sha256=${file.sha256 || "-"}`));

    const actions = el("div", "package-actions");
    const dl = el("a", "btn btn-primary", "下载");
    dl.href = file.downloadPath;
    dl.setAttribute("download", file.fileName);
    dl.setAttribute("target", "_blank");
    dl.setAttribute("rel", "noreferrer");
    actions.appendChild(dl);

    row.append(left, actions);
    filesWrap.appendChild(row);
  });
  card.appendChild(filesWrap);

  return card;
}

function renderPackageCatalog(payload, activeLang) {
  const listNode = document.getElementById("package-catalog-list");
  listNode.innerHTML = "";

  if (!payload || !Array.isArray(payload.packages) || payload.packages.length === 0) {
    const empty = el("div", "list-item package-empty", "暂无可下载包，请先执行 npm run sdk:package 生成制品。");
    listNode.appendChild(empty);
    return;
  }

  const filteredPackages = filterPackagesByLang(payload, activeLang);
  if (filteredPackages.length === 0) {
    const empty = el(
      "div",
      "list-item package-empty",
      `当前语言 ${LANG_LABELS[activeLang] || activeLang} 暂无可下载 SDK 包。`,
    );
    listNode.appendChild(empty);
    return;
  }

  filteredPackages.forEach((pkg) => {
    listNode.appendChild(renderPackageCard(pkg));
  });
}

function renderCatalogStatus() {
  const statusNode = document.getElementById("package-catalog-status");
  statusNode.classList.remove("error");

  if (state.loading) {
    statusNode.textContent = "正在加载包清单...";
    return;
  }

  if (state.catalogError) {
    statusNode.classList.add("error");
    statusNode.textContent = `加载失败：${state.catalogError.message}`;
    return;
  }

  if (!state.catalogPayload || !Array.isArray(state.catalogPayload.packages)) {
    statusNode.textContent = "暂无包清单数据";
    return;
  }

  const filteredCount = filterPackagesByLang(state.catalogPayload, state.activeLang).length;
  const generatedAt = state.catalogPayload.generatedAt ? new Date(state.catalogPayload.generatedAt).toLocaleString() : "unknown";
  const warningCount = Array.isArray(state.catalogPayload.warnings) ? state.catalogPayload.warnings.length : 0;
  const warningText = warningCount > 0 ? `，告警 ${warningCount} 条` : "";

  statusNode.textContent = `当前语言 ${LANG_LABELS[state.activeLang] || state.activeLang}：${filteredCount} 个包；总计 ${state.catalogPayload.count} 个，生成时间 ${generatedAt}${warningText}`;
}

function renderIntegration() {
  switchLang(state.activeLang);
  renderPackageCatalog(state.catalogPayload, state.activeLang);
  renderCatalogStatus();
}

async function refreshPackageCatalog() {
  const refreshBtn = document.getElementById("btn-refresh-packages");

  refreshBtn.disabled = true;
  state.loading = true;
  state.catalogError = null;
  renderCatalogStatus();

  try {
    state.catalogPayload = await api("/v1/integration/packages");
  } catch (error) {
    state.catalogError = error;
    state.catalogPayload = null;
  } finally {
    state.loading = false;
    refreshBtn.disabled = false;
    renderIntegration();
  }
}

export function mountIntegrationModule() {
  const tabs = document.getElementById("integration-tabs");
  tabs.addEventListener("click", (event) => {
    const target = event.target;
    if (!target.classList.contains("lang-btn")) {
      return;
    }
    state.activeLang = target.getAttribute("data-lang") || "javascript";
    renderIntegration();
  });

  document.getElementById("btn-refresh-packages").addEventListener("click", () => {
    refreshPackageCatalog().catch(() => {
      // no-op
    });
  });

  state.activeLang = "javascript";
  renderIntegration();
  refreshPackageCatalog().catch(() => {
    // no-op
  });
}
