import { badge, escapeHtml, fmtTime } from "./format.js";

function drawTrend(points) {
  const canvas = document.getElementById("error-trend");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  if (!points || points.length === 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.fillText("暂无趋势数据", 20, 30);
    return;
  }

  const maxValue = Math.max(1, ...points.map((p) => Math.max(p.total, p.errors)));
  const pad = 26;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  ctx.strokeStyle = "#d5e0ea";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  function drawLine(field, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((point, idx) => {
      const x = pad + (idx / Math.max(1, points.length - 1)) * chartW;
      const y = pad + chartH - (point[field] / maxValue) * chartH;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }

  drawLine("total", "#0b63f3");
  drawLine("errors", "#c62828");

  ctx.fillStyle = "#102a43";
  ctx.font = "12px sans-serif";
  ctx.fillText("蓝线: 总日志", 24, 16);
  ctx.fillText("红线: 错误日志", 122, 16);
}

function renderKpi(overview) {
  const rows = [
    ["近1小时日志", overview.logsInWindow],
    ["近1小时错误", overview.errorsInWindow],
    ["错误率", `${(overview.errorRate * 100).toFixed(2)}%`],
    ["活跃链路", overview.traceCountInWindow],
    ["活跃服务", overview.serviceCountInWindow],
    ["待修复任务", overview.pendingTasks],
    ["进行中任务", overview.inProgressTasks],
    ["Open Bug", overview.openBugCount],
  ];

  document.getElementById("kpi-grid").innerHTML = rows
    .map(
      ([title, value]) =>
        `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value">${value}</div><div class="kpi-sub">last analysis: ${fmtTime(overview.lastAnalysisAt)}</div></div>`,
    )
    .join("");
}

function renderTopErrors(topErrors) {
  const node = document.getElementById("top-errors");
  if (!topErrors || topErrors.length === 0) {
    node.innerHTML = "<div class='list-item'>暂无异常</div>";
    return;
  }

  node.innerHTML = topErrors
    .map(
      (item) => `
      <div class="list-item">
        <div class="item-title">${escapeHtml(item.title)}</div>
        <div>count: <strong>${item.count}</strong></div>
        <div>services: ${escapeHtml((item.services || []).join(", ") || "-")}</div>
        <div>last seen: ${fmtTime(item.lastSeen)}</div>
      </div>
    `,
    )
    .join("");
}

function renderServiceHealth(services) {
  const node = document.getElementById("service-table");
  if (!services || services.length === 0) {
    node.innerHTML = "<div class='list-item'>暂无服务数据</div>";
    return;
  }

  node.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Status</th>
          <th>Logs</th>
          <th>Errors</th>
          <th>Error Rate</th>
          <th>P95 (ms)</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>
        ${services
          .map(
            (s) => `
          <tr>
            <td>${escapeHtml(s.service)}</td>
            <td>${badge(s.status)}</td>
            <td>${s.totalLogs}</td>
            <td>${s.errorLogs}</td>
            <td>${(s.errorRate * 100).toFixed(2)}%</td>
            <td>${Math.round(s.p95LatencyMs || 0)}</td>
            <td>${fmtTime(s.lastSeen)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderTaskSnapshot(tasks) {
  const node = document.getElementById("task-snapshot");
  if (!tasks || tasks.length === 0) {
    node.innerHTML = "<div class='list-item'>暂无任务</div>";
    return;
  }

  node.innerHTML = tasks
    .slice(0, 8)
    .map(
      (task) => `
      <div class="list-item">
        <div class="item-title">${escapeHtml(task.payload?.title || "untitled")}</div>
        <div>${badge(task.status)} priority=P${task.priority || 1}</div>
        <div>assignee: ${escapeHtml(task.assignee || "unassigned")}</div>
        <div>updated: ${fmtTime(task.updatedAt)}</div>
      </div>
    `,
    )
    .join("");
}

export function renderDashboard(payload) {
  renderKpi(payload.overview);
  drawTrend(payload.errorTrend);
  renderTopErrors(payload.topErrors);
  renderServiceHealth(payload.services);
  renderTaskSnapshot(payload.repairTasks);
}
