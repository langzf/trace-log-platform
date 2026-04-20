import { api } from "./api.js";
import { badge, escapeHtml, fmtTime } from "./format.js";

function renderTraces(traces) {
  const node = document.getElementById("trace-table");
  if (!traces || traces.length === 0) {
    node.innerHTML = "<div class='list-item'>未查询到链路</div>";
    return;
  }

  node.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>TraceId</th>
          <th>Status</th>
          <th>Service</th>
          <th>Logs</th>
          <th>Errors</th>
          <th>Duration(ms)</th>
          <th>Started</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
      ${traces
        .map(
          (t) => `
        <tr>
          <td>${escapeHtml(t.traceId)}</td>
          <td>${badge(t.status)}</td>
          <td>${escapeHtml(t.service || "-")}</td>
          <td>${t.logCount}</td>
          <td>${t.errorCount}</td>
          <td>${t.durationMs}</td>
          <td>${fmtTime(t.startedAt)}</td>
          <td><button class="btn btn-primary btn-trace-view" data-trace-id="${escapeHtml(t.traceId)}">查看</button></td>
        </tr>
      `,
        )
        .join("")}
      </tbody>
    </table>
  `;
}

async function loadTraceDetail(traceId) {
  const data = await api(`/v1/traces/${encodeURIComponent(traceId)}`);
  document.getElementById("trace-detail").textContent = JSON.stringify(data, null, 2);
}

async function queryTraces() {
  const service = document.getElementById("trace-filter-service").value.trim();
  const status = document.getElementById("trace-filter-status").value;
  const keyword = document.getElementById("trace-filter-keyword").value.trim();

  const qs = new URLSearchParams();
  if (service) {
    qs.set("service", service);
  }
  if (status) {
    qs.set("status", status);
  }
  if (keyword) {
    qs.set("keyword", keyword);
  }
  qs.set("limit", "50");

  const data = await api(`/v1/traces?${qs.toString()}`);
  renderTraces(data.traces);
}

export function mountTracesModule(log) {
  document.getElementById("btn-query-traces").addEventListener("click", () => {
    queryTraces().catch((error) => log("链路查询失败", error.message));
  });

  document.getElementById("btn-load-trace").addEventListener("click", () => {
    const traceId = document.getElementById("trace-id-input").value.trim();
    if (!traceId) {
      log("加载链路失败", "traceId 为空");
      return;
    }
    loadTraceDetail(traceId)
      .then(() => log("链路详情已加载", traceId))
      .catch((error) => log("加载链路失败", error.message));
  });

  document.getElementById("trace-table").addEventListener("click", (event) => {
    const target = event.target;
    if (!target.classList.contains("btn-trace-view")) {
      return;
    }
    const traceId = target.getAttribute("data-trace-id");
    document.getElementById("trace-id-input").value = traceId;
    loadTraceDetail(traceId)
      .then(() => log("链路详情已加载", traceId))
      .catch((error) => log("加载链路失败", error.message));
  });

  return {
    refresh: queryTraces,
  };
}
