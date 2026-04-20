const VIEW_META = {
  dashboard: { title: "Dashboard", subtitle: "系统全景监控与风险识别" },
  traces: { title: "Trace Explorer", subtitle: "多条件链路检索与调用明细排查" },
  bugs: { title: "Bug Center", subtitle: "异常聚类结果与根因假设管理" },
  tasks: { title: "Task Center", subtitle: "修复任务认领、推进与验证" },
  integration: { title: "Integration Hub", subtitle: "多语言接入模板与复制即用片段" },
  traffic: { title: "Traffic Lab", subtitle: "构造测试流量验证分析与任务闭环" },
};

function switchView(view) {
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-active", section.id === `view-${view}`);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-view") === view);
  });

  const meta = VIEW_META[view] || VIEW_META.dashboard;
  document.getElementById("view-title").textContent = meta.title;
  document.getElementById("view-subtitle").textContent = meta.subtitle;
}

export function mountNavigation() {
  document.getElementById("nav").addEventListener("click", (event) => {
    const target = event.target;
    if (!target.classList.contains("nav-btn")) {
      return;
    }
    switchView(target.getAttribute("data-view"));
  });

  switchView("dashboard");
}
