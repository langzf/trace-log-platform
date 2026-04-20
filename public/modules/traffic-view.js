export function mountTrafficModule({ sdk, log, onDataChanged }) {
  async function simulateSuccess() {
    const trace = sdk.startTrace({ scenario: "simulate_success" });
    const result = await sdk.tracedFetch("/api/simulate/success", { method: "GET" }, trace);
    const payload = await result.response.json();
    log("生成成功链路", payload);
    await sdk.flush();
    await onDataChanged();
  }

  async function simulateFail() {
    const trace = sdk.startTrace({ scenario: "simulate_fail" });
    const result = await sdk.tracedFetch("/api/simulate/fail", { method: "GET" }, trace);
    const payload = await result.response.json();
    log("生成异常链路", payload);
    await sdk.flush();
    await onDataChanged();
  }

  document.getElementById("btn-sim-success").addEventListener("click", () => {
    simulateSuccess().catch((error) => log("模拟失败", error.message));
  });

  document.getElementById("btn-sim-fail").addEventListener("click", () => {
    simulateFail().catch((error) => log("模拟失败", error.message));
  });
}
