export function createConsoleLogger(elementId) {
  const node = document.getElementById(elementId);

  function log(title, payload) {
    const now = new Date().toLocaleTimeString();
    const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    node.textContent = `[${now}] ${title}\n${text}\n\n` + node.textContent;
  }

  return {
    log,
  };
}
