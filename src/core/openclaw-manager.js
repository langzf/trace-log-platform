import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_HEALTH_TIMEOUT_MS = 5000;

function safeOutput(value = "", limit = 4000) {
  const text = String(value || "");
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...(truncated)`;
}

async function runShell(command, { timeoutMs = DEFAULT_INSTALL_TIMEOUT_MS } = {}) {
  const { stdout, stderr } = await execFileAsync("/bin/zsh", ["-lc", command], {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 5,
  });
  return {
    stdout: String(stdout || ""),
    stderr: String(stderr || ""),
  };
}

export async function probeOpenClaw({
  binaryName = "openclaw",
  checkCommand = "openclaw --version",
} = {}) {
  try {
    const binaryResult = await runShell(`command -v ${binaryName}`, { timeoutMs: 3000 });
    const binaryPath = binaryResult.stdout.trim().split("\n").filter(Boolean).slice(-1)[0] || null;
    const versionResult = await runShell(checkCommand, { timeoutMs: 5000 });
    const versionText = versionResult.stdout.trim() || versionResult.stderr.trim() || "unknown";
    return {
      installed: Boolean(binaryPath),
      binaryPath,
      version: safeOutput(versionText, 500),
      checkCommand,
      error: null,
    };
  } catch (error) {
    return {
      installed: false,
      binaryPath: null,
      version: null,
      checkCommand,
      error: safeOutput(error?.message || String(error), 500),
    };
  }
}

export async function runOpenClawInstall({
  installCommand,
  dryRun = false,
  timeoutMs = DEFAULT_INSTALL_TIMEOUT_MS,
} = {}) {
  if (!installCommand || !String(installCommand).trim()) {
    throw new Error("installCommand is required");
  }

  if (dryRun) {
    return {
      executed: false,
      dryRun: true,
      installCommand,
      stdout: "",
      stderr: "",
    };
  }

  const result = await runShell(String(installCommand), { timeoutMs });
  return {
    executed: true,
    dryRun: false,
    installCommand,
    stdout: safeOutput(result.stdout),
    stderr: safeOutput(result.stderr),
  };
}

export async function checkOpenClawEndpointHealth({
  endpoint,
  healthPath = "/health",
  timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
} = {}) {
  if (!endpoint) {
    return {
      ok: false,
      url: null,
      statusCode: null,
      body: null,
      error: "endpoint is required",
    };
  }

  try {
    const url = new URL(healthPath || "/health", endpoint).toString();
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const rawBody = await res.text();
    return {
      ok: res.ok,
      url,
      statusCode: res.status,
      body: safeOutput(rawBody, 1200),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      url: null,
      statusCode: null,
      body: null,
      error: safeOutput(error?.message || String(error), 500),
    };
  }
}

export async function syncExecutorToRepairReceiver({
  baseUrl,
  executorPayload,
  timeoutMs = 5000,
} = {}) {
  if (!baseUrl) {
    return {
      ok: false,
      url: null,
      statusCode: null,
      response: null,
      error: "baseUrl is required",
    };
  }
  if (!executorPayload || typeof executorPayload !== "object") {
    return {
      ok: false,
      url: null,
      statusCode: null,
      response: null,
      error: "executorPayload is required",
    };
  }

  const url = new URL("/v1/config/executors", baseUrl).toString();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(executorPayload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return {
      ok: res.ok,
      url,
      statusCode: res.status,
      response: safeOutput(text, 1500),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      url,
      statusCode: null,
      response: null,
      error: safeOutput(error?.message || String(error), 500),
    };
  }
}
