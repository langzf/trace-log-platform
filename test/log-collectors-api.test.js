import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { startServer } from "../src/server.js";

function tempDataFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-collectors-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

function tempLogFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-collector-source-${Date.now()}-${Math.random().toString(16).slice(2)}.log`,
  );
}

test("log collector config + run should ingest lines into logs", { concurrency: false }, async (t) => {
  const dataFilePath = tempDataFile();
  const logFilePath = tempLogFile();
  await fs.writeFile(
    logFilePath,
    [
      '{"level":"info","message":"service started","traceId":"tr_collector_1"}',
      '{"level":"error","message":"payment timeout","traceId":"tr_collector_2","statusCode":504}',
      "WARN fallback plain line message",
      "",
    ].join("\n"),
    "utf8",
  );

  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    enableCollectorScheduler: false,
    dataFilePath,
  });
  t.after(async () => {
    await instance.close();
    await fs.rm(logFilePath, { force: true });
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;

  const upsertRes = await fetch(`${baseUrl}/v1/config/log-collectors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      collectorKey: "collector-local-a",
      projectKey: "order-system",
      service: "payment-service",
      mode: "local_file",
      enabled: true,
      pollIntervalSec: 30,
      source: {
        filePath: logFilePath,
        fromEndOnFirstRun: false,
      },
      parse: {
        format: "auto",
      },
      options: {
        maxLinesPerRun: 200,
      },
    }),
  });
  assert.equal(upsertRes.status, 200);
  const upsertBody = await upsertRes.json();
  assert.equal(upsertBody.ok, true);
  assert.equal(upsertBody.collector.collectorKey, "collector-local-a");

  const runRes = await fetch(`${baseUrl}/v1/config/log-collectors/collector-local-a/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(runRes.status, 200);
  const runBody = await runRes.json();
  assert.equal(runBody.ok, true);
  assert.ok(runBody.result.run.ingestedCount >= 2);

  const logsRes = await fetch(`${baseUrl}/v1/logs?service=payment-service&limit=20`);
  assert.equal(logsRes.status, 200);
  const logsBody = await logsRes.json();
  assert.equal(logsBody.ok, true);
  assert.ok(logsBody.count >= 2);

  const runsRes = await fetch(`${baseUrl}/v1/log-collector-runs?collectorKey=collector-local-a`);
  assert.equal(runsRes.status, 200);
  const runsBody = await runsRes.json();
  assert.equal(runsBody.ok, true);
  assert.equal(runsBody.count, 1);
  assert.equal(runsBody.runs[0].status, "success");
});

test("log collector config should reject invalid payload", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    enableCollectorScheduler: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;

  const badRes = await fetch(`${baseUrl}/v1/config/log-collectors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      collectorKey: "bad",
      projectKey: "order-system",
      service: "payment-service",
      mode: "local_file",
      source: {},
    }),
  });
  assert.equal(badRes.status, 400);
  const badBody = await badRes.json();
  assert.equal(badBody.ok, false);
  assert.equal(badBody.errorCode, "ERR-1001");
});

test("syslog_http collector should ingest pushed lines with token validation", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    enableCollectorScheduler: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const upsertRes = await fetch(`${baseUrl}/v1/config/log-collectors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      collectorKey: "collector-syslog-a",
      projectKey: "order-system",
      service: "gateway-service",
      mode: "syslog_http",
      enabled: true,
      pollIntervalSec: 30,
      source: {
        token: "syslog-token-123",
      },
      options: {
        maxLinesPerPush: 100,
      },
    }),
  });
  assert.equal(upsertRes.status, 200);

  const unauthorizedRes = await fetch(`${baseUrl}/v1/logs/syslog`, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      "x-collector-key": "collector-syslog-a",
      "x-collector-token": "wrong-token",
    },
    body: "ERROR payment timeout traceId=tr_syslog_unauthorized_1",
  });
  assert.equal(unauthorizedRes.status, 401);

  const pushRes = await fetch(`${baseUrl}/v1/logs/syslog`, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      "x-collector-key": "collector-syslog-a",
      "x-collector-token": "syslog-token-123",
    },
    body: [
      "INFO gateway started traceId=tr_syslog_1",
      "ERROR payment timeout traceId=tr_syslog_2",
      "",
    ].join("\n"),
  });
  assert.equal(pushRes.status, 201);
  const pushBody = await pushRes.json();
  assert.equal(pushBody.ok, true);
  assert.equal(pushBody.count, 2);

  const logsRes = await fetch(`${baseUrl}/v1/logs?service=gateway-service&limit=20`);
  assert.equal(logsRes.status, 200);
  const logsBody = await logsRes.json();
  assert.equal(logsBody.ok, true);
  assert.ok(logsBody.count >= 2);
  assert.ok(logsBody.logs.some((item) => item.meta?.collectorMode === "syslog_http"));
});

test("log collector should validate new modes required fields", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    enableCollectorScheduler: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;

  const journaldBad = await fetch(`${baseUrl}/v1/config/log-collectors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      collectorKey: "collector-journald-bad",
      projectKey: "order-system",
      service: "app-service",
      mode: "journald",
      source: {},
    }),
  });
  assert.equal(journaldBad.status, 400);

  const ossBad = await fetch(`${baseUrl}/v1/config/log-collectors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      collectorKey: "collector-oss-bad",
      projectKey: "order-system",
      service: "app-service",
      mode: "oss_pull",
      source: {},
    }),
  });
  assert.equal(ossBad.status, 400);
});
