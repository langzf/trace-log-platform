import { api } from "./api.js";
import { badge, escapeHtml, fmtTime } from "./format.js";

function renderBugs(bugs) {
  const node = document.getElementById("bug-list");
  if (!bugs || bugs.length === 0) {
    node.innerHTML = "<div class='list-item'>暂无缺陷</div>";
    return;
  }

  node.innerHTML = bugs
    .map(
      (bug) => `
      <div class="list-item">
        <div class="item-title">${escapeHtml(bug.title)}</div>
        <div>${badge(bug.severity)} ${badge(bug.status)}</div>
        <div>次数=${bug.count}，关联链路=${(bug.traceIds || []).length}</div>
        <div>摘要：${escapeHtml(bug.summary || "")}</div>
        <div>根因假设：${escapeHtml(bug.rootCauseHypothesis || "")}</div>
        <div>最近出现：${fmtTime(bug.lastSeen)}</div>
      </div>
    `,
    )
    .join("");
}

async function queryBugs(getScope) {
  const status = document.getElementById("bug-filter-status").value;
  const severity = document.getElementById("bug-filter-severity").value;
  const scope = typeof getScope === "function" ? getScope() : {};
  const qs = new URLSearchParams();
  if (scope?.projectKey) {
    qs.set("projectKey", scope.projectKey);
  }
  if (status) {
    qs.set("status", status);
  }
  if (severity) {
    qs.set("severity", severity);
  }

  const data = await api(`/v1/bugs?${qs.toString()}`);
  renderBugs(data.bugs);
}

export function mountBugsModule(log, getScope) {
  document.getElementById("btn-query-bugs").addEventListener("click", () => {
    queryBugs(getScope).catch((error) => log("缺陷查询失败", error.message));
  });

  return {
    refresh: () => queryBugs(getScope),
  };
}
