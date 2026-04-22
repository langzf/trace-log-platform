import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { startServer } from "../src/server.js";

function tempDataFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-audit-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

function tempDbFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-audit-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
  );
}

function querySqliteCount(dbPath, tableName) {
  const out = execFileSync("sqlite3", ["-json", dbPath, `SELECT COUNT(*) AS c FROM ${tableName};`], {
    encoding: "utf8",
  }).trim();
  return JSON.parse(out)[0].c;
}

test("audit logs should be recorded for config and issue actions and support filtering", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;

  const upsertProjectRes = await fetch(`${baseUrl}/v1/config/projects`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-operator-type": "human",
      "x-operator-id": "ops-admin",
    },
    body: JSON.stringify({
      projectKey: "order-service",
      repoUrl: "git@github.com:acme/order-service.git",
      defaultBranch: "main",
      status: "active",
    }),
  });
  assert.equal(upsertProjectRes.status, 200);

  const ingestRes = await fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: "order-service",
      eventId: `evt_audit_${Date.now()}`,
      sourceType: "feedback",
      payload: {
        message: "checkout failed",
        service: "order-web",
        level: "warn",
      },
    }),
  });
  assert.equal(ingestRes.status, 202);

  const listRes = await fetch(`${baseUrl}/v1/audit-logs`);
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.ok, true);
  assert.ok(listBody.count >= 2);
  assert.ok(listBody.items.some((item) => item.action === "config.project.upsert"));
  assert.ok(listBody.items.some((item) => item.action === "issue.created"));

  const filteredRes = await fetch(
    `${baseUrl}/v1/audit-logs?entityType=project&entityId=${encodeURIComponent("order-service")}&operatorType=human`,
  );
  assert.equal(filteredRes.status, 200);
  const filteredBody = await filteredRes.json();
  assert.equal(filteredBody.ok, true);
  assert.ok(filteredBody.count >= 1);
  assert.equal(filteredBody.items[0].operatorId, "ops-admin");
});

test("audit logs should optionally be persisted to sqlite sink", { concurrency: false }, async (t) => {
  const sqlitePath = tempDbFile();
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
    enableSqliteAudit: true,
    auditDbPath: sqlitePath,
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;

  const upsertExecutorRes = await fetch(`${baseUrl}/v1/config/executors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      executorKey: "exec-audit-sqlite",
      endpoint: "http://127.0.0.1:18789/v1",
      kind: "codex",
      enabled: true,
      priority: 5,
    }),
  });
  assert.equal(upsertExecutorRes.status, 200);

  const count = querySqliteCount(sqlitePath, "audit_log");
  assert.ok(count >= 1);
});
