const VIEW_META = {
  dashboard: { title: "系统总览", subtitle: "系统全景监控与风险识别" },
  traces: { title: "链路追踪", subtitle: "多条件链路检索与调用明细排查" },
  bugs: { title: "缺陷中心", subtitle: "异常聚类结果与根因假设管理" },
  tasks: { title: "任务中心", subtitle: "修复任务认领、推进与验证" },
  collectors: { title: "采集中心", subtitle: "多模式日志采集配置与运行状态" },
  integration: { title: "接入中心", subtitle: "多语言接入模板 + 真实 SDK/Starter 包下载" },
  traffic: { title: "流量实验室", subtitle: "构造测试流量验证分析与任务闭环" },
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
