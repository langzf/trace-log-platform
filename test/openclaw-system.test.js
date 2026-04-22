import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { startServer } from "../src/server.js";

function tempDataFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-openclaw-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

function startMockRepairReceiver() {
  return new Promise((resolve, reject) => {
    const requests = [];
    const server = http.createServer(async (req, res) => {
      if (req.method === "POST" && req.url === "/v1/config/executors") {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        requests.push({ method: req.method, url: req.url, body });
        res.statusCode = 200;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: true, executor: body }));
        return;
      }

      if (req.method === "GET" && req.url?.startsWith("/v1/config/executors/")) {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: true, executor: { executorKey: "openclaw-local" } }));
        return;
      }

      res.statusCode = 404;
      res.end("not found");
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("unable to start mock receiver"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        requests,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test("GET /v1/system/openclaw/status should return probe and local executor info", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  await instance.store.upsertExecutor({
    executorKey: "openclaw-local",
    kind: "openclaw-gateway",
    endpoint: "http://127.0.0.1:18789",
    enabled: true,
    priority: 10,
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const res = await fetch(`${baseUrl}/v1/system/openclaw/status?checkCommand=${encodeURIComponent("echo test")}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.openclaw);
  assert.ok(Array.isArray(body.executors));
  assert.ok(body.executors.some((item) => item.executorKey === "openclaw-local"));
});

test("POST /v1/system/openclaw/install should support dry-run and sync receiver", { concurrency: false }, async (t) => {
  const mockReceiver = await startMockRepairReceiver();
  t.after(async () => {
    await mockReceiver.close();
  });

  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const res = await fetch(`${baseUrl}/v1/system/openclaw/install`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dryRun: true,
      installMode: "binary",
      binaryUrl: "https://example.com/openclaw.tar.gz",
      binarySha256: "a".repeat(64),
      endpoint: "http://127.0.0.1:18789",
      executorKey: "openclaw-local",
      autoRegisterExecutor: true,
      syncToRepairReceiver: true,
      repairReceiverBaseUrl: mockReceiver.baseUrl,
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.install.dryRun, true);
  assert.equal(body.install.commandSource, "default.install_script");
  assert.ok(body.localExecutor);
  assert.equal(body.localExecutor.executorKey, "openclaw-local");
  assert.ok(body.repairReceiverSync);
  assert.equal(body.repairReceiverSync.ok, true);
  assert.equal(mockReceiver.requests.length, 1);
  assert.equal(mockReceiver.requests[0].body.executorKey, "openclaw-local");
});

test("POST /v1/system/openclaw/install should return 502 when install command fails in real mode", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const res = await fetch(`${baseUrl}/v1/system/openclaw/install`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dryRun: false,
      forceReinstall: true,
      installCommand: "false",
    }),
  });
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.errorCode, "ERR-2001");
});
