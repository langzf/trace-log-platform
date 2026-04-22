import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { startServer } from "../src/server.js";

function tempDataFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-config-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

test("POST/GET /v1/config/executors should upsert and query executor profiles", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const createRes = await fetch(`${baseUrl}/v1/config/executors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      executorKey: "exec-codex-a",
      kind: "codex",
      endpoint: "http://10.0.0.11:18789/v1",
      enabled: true,
      priority: 10,
    }),
  });
  assert.equal(createRes.status, 200);
  const createBody = await createRes.json();
  assert.equal(createBody.ok, true);
  assert.equal(createBody.executor.executorKey, "exec-codex-a");

  const updateRes = await fetch(`${baseUrl}/v1/config/executors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      executorKey: "exec-codex-a",
      endpoint: "http://10.0.0.11:18790/v1",
      enabled: false,
      priority: 8,
    }),
  });
  assert.equal(updateRes.status, 200);
  const updateBody = await updateRes.json();
  assert.equal(updateBody.ok, true);
  assert.equal(updateBody.executor.enabled, false);
  assert.equal(updateBody.executor.priority, 8);

  const listAllRes = await fetch(`${baseUrl}/v1/config/executors`);
  assert.equal(listAllRes.status, 200);
  const listAllBody = await listAllRes.json();
  assert.equal(listAllBody.ok, true);
  assert.equal(listAllBody.count, 1);
  assert.equal(listAllBody.executors[0].endpoint, "http://10.0.0.11:18790/v1");

  const listEnabledRes = await fetch(`${baseUrl}/v1/config/executors?enabled=true`);
  assert.equal(listEnabledRes.status, 200);
  const listEnabledBody = await listEnabledRes.json();
  assert.equal(listEnabledBody.ok, true);
  assert.equal(listEnabledBody.count, 0);
});

test("POST/GET /v1/config/projects should upsert and query project profiles", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const createRes = await fetch(`${baseUrl}/v1/config/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: "order-service",
      repoUrl: "git@github.com:acme/order-service.git",
      defaultBranch: "main",
      status: "active",
    }),
  });
  assert.equal(createRes.status, 200);
  const createBody = await createRes.json();
  assert.equal(createBody.ok, true);
  assert.equal(createBody.project.projectKey, "order-service");

  const updateRes = await fetch(`${baseUrl}/v1/config/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: "order-service",
      repoUrl: "git@github.com:acme/order-service.git",
      defaultBranch: "release",
      status: "paused",
    }),
  });
  assert.equal(updateRes.status, 200);
  const updateBody = await updateRes.json();
  assert.equal(updateBody.ok, true);
  assert.equal(updateBody.project.defaultBranch, "release");
  assert.equal(updateBody.project.status, "paused");

  const listRes = await fetch(`${baseUrl}/v1/config/projects?status=paused`);
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.ok, true);
  assert.equal(listBody.count, 1);
  assert.equal(listBody.projects[0].projectKey, "order-service");
});

test("config APIs should reject invalid payload", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const badExecutorRes = await fetch(`${baseUrl}/v1/config/executors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      executorKey: "exec-a",
    }),
  });
  assert.equal(badExecutorRes.status, 400);
  const badExecutorBody = await badExecutorRes.json();
  assert.equal(badExecutorBody.ok, false);
  assert.equal(badExecutorBody.errorCode, "ERR-1001");

  const badProjectRes = await fetch(`${baseUrl}/v1/config/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: "p1",
    }),
  });
  assert.equal(badProjectRes.status, 400);
  const badProjectBody = await badProjectRes.json();
  assert.equal(badProjectBody.ok, false);
  assert.equal(badProjectBody.errorCode, "ERR-1001");
});
