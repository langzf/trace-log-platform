export function fmtTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

export function badge(value) {
  const raw = String(value || "");
  const key = raw.toLowerCase();
  const labelMap = {
    ok: "正常",
    failed: "失败",
    open: "待修复",
    fixed: "已修复",
    pending: "待处理",
    in_progress: "处理中",
    deployed: "已部署",
    verified: "已验证",
    critical: "紧急",
    high: "高",
    medium: "中",
    low: "低",
    healthy: "健康",
    degraded: "降级",
    success: "成功",
    unknown: "未知",
    active: "启用",
    paused: "暂停",
    disabled: "禁用",
  };
  return `<span class="badge badge-${key}">${labelMap[key] || raw}</span>`;
}

export function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
