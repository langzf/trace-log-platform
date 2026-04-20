import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { startServer } from "../src/server.js";

test("platform should create repair tasks after analysis", async (t) => {
  const dataFilePath = path.join(
    os.tmpdir(),
    `trace-log-platform-test-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );

  const instance = await startServer({ port: 0, dataFilePath, enableAutoAnalyze: false });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const traceId = `tr_test_${Date.now()}`;

  await fetch(`${baseUrl}/v1/logs/frontend`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-app": "e2e-web",
    },
    body: JSON.stringify({
      traceId,
      spanId: "sp_front_root",
      level: "info",
      message: "frontend click",
      path: "/demo",
      meta: { scenario: "e2e" },
    }),
  });

  const failRes = await fetch(`${baseUrl}/api/simulate/fail`, {
    headers: {
      "x-trace-id": traceId,
      "x-parent-span-id": "sp_front_root",
      "x-client-app": "e2e-web",
    },
  });
  assert.equal(failRes.status, 500);

  const analyzeRes = await fetch(`${baseUrl}/v1/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const analyzeData = await analyzeRes.json();

  assert.equal(analyzeData.ok, true);
  assert.ok(analyzeData.bugCount >= 1);

  const taskRes = await fetch(`${baseUrl}/v1/repair-tasks`);
  const taskData = await taskRes.json();

  assert.equal(taskData.ok, true);
  assert.ok(taskData.count >= 1);
  assert.ok(taskData.tasks[0].payload.traceIds.includes(traceId));

  const claimRes = await fetch(`${baseUrl}/v1/repair-tasks/${taskData.tasks[0].id}/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assignee: "repair-bot-test" }),
  });
  const claimData = await claimRes.json();
  assert.equal(claimData.ok, true);
  assert.equal(claimData.task.status, "in_progress");

  const patchRes = await fetch(`${baseUrl}/v1/repair-tasks/${taskData.tasks[0].id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "verified", note: "validated by e2e test" }),
  });
  const patchData = await patchRes.json();
  assert.equal(patchData.ok, true);
  assert.equal(patchData.task.status, "verified");

  const dashboardRes = await fetch(`${baseUrl}/v1/dashboard/full`);
  const dashboardData = await dashboardRes.json();
  assert.equal(dashboardData.ok, true);
  assert.ok(Array.isArray(dashboardData.errorTrend));
  assert.ok(Array.isArray(dashboardData.services));
  assert.ok(Array.isArray(dashboardData.repairTasks));
});
