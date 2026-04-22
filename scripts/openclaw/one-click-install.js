import process from "node:process";

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (token === "--install-command") {
      options.installCommand = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--install-mode") {
      options.installMode = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--target-version") {
      options.targetVersion = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--binary-url") {
      options.binaryUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--binary-sha256") {
      options.binarySha256 = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--bootstrap-url") {
      options.bootstrapUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--install-dir") {
      options.installDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--expect-health") {
      options.expectHealth = true;
      continue;
    }
    if (token === "--force-reinstall") {
      options.forceReinstall = true;
      continue;
    }
    if (token === "--post-install-command") {
      options.postInstallCommand = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--endpoint") {
      options.endpoint = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--executor-key") {
      options.executorKey = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--repair-receiver-base-url") {
      options.repairReceiverBaseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }
  return options;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  node scripts/openclaw/one-click-install.js [--dry-run]
    [--install-command "<command>"]
    [--install-mode "auto|brew|binary|bootstrap"]
    [--target-version "2026.3.13"]
    [--binary-url "https://.../openclaw.tar.gz"]
    [--binary-sha256 "<sha256>"]
    [--bootstrap-url "https://.../install.sh"]
    [--install-dir "/usr/local/bin"]
    [--force-reinstall]
    [--expect-health]
    [--post-install-command "<command>"]
    [--endpoint "http://127.0.0.1:18789"]
    [--executor-key "openclaw-local"]
    [--repair-receiver-base-url "http://127.0.0.1:8788"]`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const baseUrl = process.env.TRACE_PLATFORM_BASE_URL || "http://127.0.0.1:3000";
  const payload = {
    dryRun: Boolean(opts.dryRun),
    forceReinstall: Boolean(opts.forceReinstall),
    installCommand: opts.installCommand || process.env.OPENCLAW_INSTALL_COMMAND || "",
    installMode: opts.installMode || process.env.OPENCLAW_INSTALL_METHOD || "auto",
    targetVersion: opts.targetVersion || process.env.OPENCLAW_TARGET_VERSION || "",
    binaryUrl: opts.binaryUrl || process.env.OPENCLAW_BINARY_URL || "",
    binarySha256: opts.binarySha256 || process.env.OPENCLAW_BINARY_SHA256 || "",
    bootstrapUrl: opts.bootstrapUrl || process.env.OPENCLAW_BOOTSTRAP_URL || "",
    installDir: opts.installDir || process.env.OPENCLAW_INSTALL_DIR || "",
    expectHealth: Boolean(opts.expectHealth || process.env.OPENCLAW_EXPECT_HEALTH === "1"),
    postInstallCommand: opts.postInstallCommand || process.env.OPENCLAW_POST_INSTALL_COMMAND || "",
    endpoint: opts.endpoint || process.env.OPENCLAW_ENDPOINT || "http://127.0.0.1:18789",
    executorKey: opts.executorKey || process.env.OPENCLAW_EXECUTOR_KEY || "openclaw-local",
    repairReceiverBaseUrl:
      opts.repairReceiverBaseUrl || process.env.REPAIR_RECEIVER_BASE_URL || "http://127.0.0.1:8788",
    autoRegisterExecutor: true,
    syncToRepairReceiver: true,
  };

  const url = new URL("/v1/system/openclaw/install", baseUrl).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ status: res.status, ok: res.ok, result: body }, null, 2));

  if (!res.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error.message || error);
  process.exitCode = 1;
});
