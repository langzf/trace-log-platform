import { api } from "./api.js";
import { badge, escapeHtml, fmtTime } from "./format.js";

function renderBugs(bugs) {
  const node = document.getElementById("bug-list");
  if (!bugs || bugs.length === 0) {
    node.innerHTML = "<div class='list-item'>暂无 bug</div>";
    return;
  }

  node.innerHTML = bugs
    .map(
      (bug) => `
      <div class="list-item">
        <div class="item-title">${escapeHtml(bug.title)}</div>
        <div>${badge(bug.severity)} ${badge(bug.status)}</div>
        <div>count=${bug.count}, traces=${(bug.traceIds || []).length}</div>
        <div>summary: ${escapeHtml(bug.summary || "")}</div>
        <div>hypothesis: ${escapeHtml(bug.rootCauseHypothesis || "")}</div>
        <div>last seen: ${fmtTime(bug.lastSeen)}</div>
      </div>
    `,
    )
    .join("");
}

async function queryBugs() {
  const status = document.getElementById("bug-filter-status").value;
  const severity = document.getElementById("bug-filter-severity").value;
  const qs = new URLSearchParams();
  if (status) {
    qs.set("status", status);
  }
  if (severity) {
    qs.set("severity", severity);
  }

  const data = await api(`/v1/bugs?${qs.toString()}`);
  renderBugs(data.bugs);
}

export function mountBugsModule(log) {
  document.getElementById("btn-query-bugs").addEventListener("click", () => {
    queryBugs().catch((error) => log("Bug 查询失败", error.message));
  });

  return {
    refresh: queryBugs,
  };
}
