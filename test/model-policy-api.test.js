import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { startServer } from "../src/server.js";

function tempDataFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-model-policy-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

test("POST/GET /v1/config/model-policies should upsert and query policies", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;

  const createRes = await fetch(`${baseUrl}/v1/config/model-policies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: "order-service",
      policyName: "default",
      defaultModelTier: "performance",
      upgradeRules: {
        on_retry: "ultimate",
      },
      budgetDailyTokens: 200000,
      budgetTaskTokens: 30000,
    }),
  });
  assert.equal(createRes.status, 200);
  const createBody = await createRes.json();
  assert.equal(createBody.ok, true);
  assert.equal(createBody.policy.projectKey, "order-service");
  assert.equal(createBody.policy.defaultModelTier, "performance");

  const updateRes = await fetch(`${baseUrl}/v1/config/model-policies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: "order-service",
      policyName: "default",
      defaultModelTier: "ultimate",
      budgetTaskTokens: 50000,
    }),
  });
  assert.equal(updateRes.status, 200);
  const updateBody = await updateRes.json();
  assert.equal(updateBody.ok, true);
  assert.equal(updateBody.policy.defaultModelTier, "ultimate");
  assert.equal(updateBody.policy.budgetTaskTokens, 50000);

  const listRes = await fetch(`${baseUrl}/v1/config/model-policies?projectKey=order-service`);
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.ok, true);
  assert.equal(listBody.count, 1);
  assert.equal(listBody.policies[0].projectKey, "order-service");
});

test("POST /v1/config/model-policies should reject invalid payload", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const res = await fetch(`${baseUrl}/v1/config/model-policies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: "order-service",
      defaultModelTier: "expensive",
    }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.errorCode, "ERR-1001");
});
