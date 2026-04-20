export function fmtTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

export function badge(value) {
  return `<span class="badge badge-${String(value).toLowerCase()}">${value}</span>`;
}

export function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
