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
        <div class="item-title">${escapeHtml(task.payload?.title || "untitled")}</div>
        <div>id: ${escapeHtml(task.id)}</div>
        <div>${badge(task.status)} priority=P${task.priority || 1}</div>
        <div>assignee: ${escapeHtml(task.assignee || "unassigned")}</div>
        <div>updated: ${fmtTime(task.updatedAt)}</div>
      </div>
    `,
    )
    .join("");
}

async function queryTasks() {
  const status = document.getElementById("task-filter-status").value;
  const qs = new URLSearchParams();
  if (status) {
    qs.set("status", status);
  }

  const data = await api(`/v1/repair-tasks?${qs.toString()}`);
  renderTasks(data.tasks);
}

async function claimFirstPending() {
  const pending = cachedTasks.find((task) => task.status === "pending");
  if (!pending) {
    return { message: "no pending task" };
  }

  const data = await api(`/v1/repair-tasks/${pending.id}/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assignee: "repair-bot-01" }),
  });
  await queryTasks();
  return data.task;
}

async function verifyFirstInProgress() {
  const task = cachedTasks.find((item) => item.status === "in_progress");
  if (!task) {
    return { message: "no in_progress task" };
  }

  const data = await api(`/v1/repair-tasks/${task.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "verified", note: "verified from console" }),
  });
  await queryTasks();
  return data.task;
}

export function mountTasksModule(log) {
  document.getElementById("btn-query-tasks").addEventListener("click", () => {
    queryTasks().catch((error) => log("Task 查询失败", error.message));
  });

  document.getElementById("btn-claim-first").addEventListener("click", () => {
    claimFirstPending()
      .then((res) => log("领取任务", res))
      .catch((error) => log("领取任务失败", error.message));
  });

  document.getElementById("btn-verify-first").addEventListener("click", () => {
    verifyFirstInProgress()
      .then((res) => log("任务状态更新", res))
      .catch((error) => log("任务更新失败", error.message));
  });

  return {
    refresh: queryTasks,
  };
}
