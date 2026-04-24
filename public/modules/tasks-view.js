import { api } from "./api.js";
import { badge, escapeHtml, fmtTime } from "./format.js";

let cachedTasks = [];

function renderTasks(tasks) {
  const node = document.getElementById("task-list");
  cachedTasks = tasks || [];

  if (!cachedTasks.length) {
    node.innerHTML = "<div class='list-item'>暂无任务</div>";
    return;
  }

  node.innerHTML = cachedTasks
    .map(
      (task) => `
      <div class="list-item">
        <div class="item-title">${escapeHtml(task.payload?.title || "未命名任务")}</div>
        <div>任务ID：${escapeHtml(task.id)}</div>
        <div>${badge(task.status)} 优先级=P${task.priority || 1}</div>
        <div>处理人：${escapeHtml(task.assignee || "未分配")}</div>
        <div>更新时间：${fmtTime(task.updatedAt)}</div>
      </div>
    `,
    )
    .join("");
}

async function queryTasks(getScope) {
  const status = document.getElementById("task-filter-status").value;
  const scope = typeof getScope === "function" ? getScope() : {};
  const qs = new URLSearchParams();
  if (scope?.projectKey) {
    qs.set("projectKey", scope.projectKey);
  }
  if (status) {
    qs.set("status", status);
  }

  const data = await api(`/v1/repair-tasks?${qs.toString()}`);
  renderTasks(data.tasks);
}

async function claimFirstPending(getScope) {
  const pending = cachedTasks.find((task) => task.status === "pending");
  if (!pending) {
    return { message: "暂无待处理任务" };
  }

  const data = await api(`/v1/repair-tasks/${pending.id}/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assignee: "repair-bot-01" }),
  });
  await queryTasks(getScope);
  return data.task;
}

async function verifyFirstInProgress(getScope) {
  const task = cachedTasks.find((item) => item.status === "in_progress");
  if (!task) {
    return { message: "暂无处理中任务" };
  }

  const data = await api(`/v1/repair-tasks/${task.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "verified", note: "verified from console" }),
  });
  await queryTasks(getScope);
  return data.task;
}

export function mountTasksModule(log, getScope) {
  document.getElementById("btn-query-tasks").addEventListener("click", () => {
    queryTasks(getScope).catch((error) => log("任务查询失败", error.message));
  });

  document.getElementById("btn-claim-first").addEventListener("click", () => {
    claimFirstPending(getScope)
      .then((res) => log("领取任务", res))
      .catch((error) => log("领取任务失败", error.message));
  });

  document.getElementById("btn-verify-first").addEventListener("click", () => {
    verifyFirstInProgress(getScope)
      .then((res) => log("任务状态更新", res))
      .catch((error) => log("任务更新失败", error.message));
  });

  return {
    refresh: () => queryTasks(getScope),
  };
}
