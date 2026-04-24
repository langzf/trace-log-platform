import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { startServer } from "../src/server.js";

function tempDataFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-scope-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

async function postJson(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

test("system scope should filter dashboard/traces/bugs/tasks by projectKey", { concurrency: false }, async (t) => {
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

  const projectARes = await postJson(`${baseUrl}/v1/config/projects`, {
    projectKey: "proj-a",
    repoUrl: "git@github.com:acme/proj-a.git",
    status: "active",
    services: ["svc-a"],
  });
  assert.equal(projectARes.status, 200);

  const projectBRes = await postJson(`${baseUrl}/v1/config/projects`, {
    projectKey: "proj-b",
    repoUrl: "git@github.com:acme/proj-b.git",
    status: "active",
    services: ["svc-b"],
  });
  assert.equal(projectBRes.status, 200);

  const logARes = await postJson(`${baseUrl}/v1/logs/backend`, {
    traceId: "tr_scope_a",
    spanId: "sp_scope_a",
    level: "error",
    message: "scope-a error",
    service: "svc-a",
    path: "/a",
    method: "GET",
    meta: { projectKey: "proj-a" },
  });
  assert.equal(logARes.status, 201);

  const logBRes = await postJson(`${baseUrl}/v1/logs/backend`, {
    traceId: "tr_scope_b",
    spanId: "sp_scope_b",
    level: "error",
    message: "scope-b error",
    service: "svc-b",
    path: "/b",
    method: "GET",
    meta: { projectKey: "proj-b" },
  });
  assert.equal(logBRes.status, 201);

  const dashboardARes = await fetch(`${baseUrl}/v1/dashboard/full?projectKey=proj-a`);
  assert.equal(dashboardARes.status, 200);
  const dashboardABody = await dashboardARes.json();
  assert.equal(dashboardABody.ok, true);
  assert.equal(dashboardABody.scope.projectKey, "proj-a");
  assert.ok(dashboardABody.overview.logsInWindow >= 1);
  assert.ok(dashboardABody.services.every((item) => item.service === "svc-a"));

  const tracesARes = await fetch(`${baseUrl}/v1/traces?projectKey=proj-a`);
  assert.equal(tracesARes.status, 200);
  const tracesABody = await tracesARes.json();
  assert.equal(tracesABody.ok, true);
  assert.ok(tracesABody.traces.some((item) => item.traceId === "tr_scope_a"));
  assert.ok(!tracesABody.traces.some((item) => item.traceId === "tr_scope_b"));

  const contextsRes = await fetch(`${baseUrl}/v1/system/contexts`);
  assert.equal(contextsRes.status, 200);
  const contextsBody = await contextsRes.json();
  assert.equal(contextsBody.ok, true);
  const projAContext = contextsBody.contexts.find((item) => item.projectKey === "proj-a");
  assert.ok(projAContext);
  assert.ok(Array.isArray(projAContext.services));
  assert.ok(projAContext.services.includes("svc-a"));

  const analyzeARes = await postJson(`${baseUrl}/v1/analyze`, {
    projectKey: "proj-a",
  });
  assert.equal(analyzeARes.status, 200);

  const bugsARes = await fetch(`${baseUrl}/v1/bugs?projectKey=proj-a`);
  assert.equal(bugsARes.status, 200);
  const bugsABody = await bugsARes.json();
  assert.equal(bugsABody.ok, true);
  assert.ok(bugsABody.count >= 1);

  const bugsBRes = await fetch(`${baseUrl}/v1/bugs?projectKey=proj-b`);
  assert.equal(bugsBRes.status, 200);
  const bugsBBody = await bugsBRes.json();
  assert.equal(bugsBBody.ok, true);
  assert.equal(bugsBBody.count, 0);

  const tasksARes = await fetch(`${baseUrl}/v1/repair-tasks?projectKey=proj-a`);
  assert.equal(tasksARes.status, 200);
  const tasksABody = await tasksARes.json();
  assert.equal(tasksABody.ok, true);
  assert.ok(tasksABody.count >= 1);

  const tasksBRes = await fetch(`${baseUrl}/v1/repair-tasks?projectKey=proj-b`);
  assert.equal(tasksBRes.status, 200);
  const tasksBBody = await tasksBRes.json();
  assert.equal(tasksBBody.ok, true);
  assert.equal(tasksBBody.count, 0);
});
