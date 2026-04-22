import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { startServer } from "../src/server.js";

function tempDataFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-events-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

test("POST /v1/events should ingest normalized event and support eventId deduplication", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const payload = {
    projectKey: "order-service",
    eventId: `evt_${Date.now()}`,
    sourceType: "feedback",
    traceId: "tr_evt_ingest_1",
    payload: {
      message: "user reported checkout error",
      level: "warn",
      service: "order-web",
      path: "/checkout",
    },
  };

  const first = await fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 202);
  const firstBody = await first.json();
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.deduplicated, false);
  assert.ok(firstBody.issueId);

  const second = await fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(second.status, 202);
  const secondBody = await second.json();
  assert.equal(secondBody.ok, true);
  assert.equal(secondBody.deduplicated, true);
  assert.equal(secondBody.issueId, firstBody.issueId);

  const storedIssue = instance.store.getIssueByEventId(payload.eventId);
  assert.ok(storedIssue);
  assert.equal(storedIssue.id, firstBody.issueId);

  const logs = instance.store.listLogs({ traceId: payload.traceId, limit: 20 });
  assert.ok(logs.length >= 1);
});

test("POST /v1/events should enforce idempotency-key replay and conflict behavior", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const idemKey = `idem-${Date.now()}`;

  const payloadA = {
    projectKey: "payment-service",
    eventId: `evt_a_${Date.now()}`,
    sourceType: "log",
    payload: {
      message: "payment timeout",
      level: "error",
      service: "payment-api",
      path: "/pay",
    },
  };

  const payloadB = {
    ...payloadA,
    eventId: `evt_b_${Date.now()}`,
    payload: {
      ...payloadA.payload,
      message: "different payload should conflict",
    },
  };

  const first = await fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idemKey,
    },
    body: JSON.stringify(payloadA),
  });
  assert.equal(first.status, 202);
  const firstBody = await first.json();
  assert.equal(firstBody.deduplicated, false);

  const replay = await fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idemKey,
    },
    body: JSON.stringify(payloadA),
  });
  assert.equal(replay.status, 202);
  const replayBody = await replay.json();
  assert.equal(replayBody.deduplicated, true);
  assert.equal(replayBody.idempotencyReplayed, true);
  assert.equal(replayBody.issueId, firstBody.issueId);

  const conflict = await fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idemKey,
    },
    body: JSON.stringify(payloadB),
  });
  assert.equal(conflict.status, 400);
  const conflictBody = await conflict.json();
  assert.equal(conflictBody.ok, false);
  assert.equal(conflictBody.errorCode, "ERR-1002");
});

test("POST /v1/events should reject invalid payload", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const res = await fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: "x",
      eventId: "evt_invalid",
      sourceType: "feedback",
    }),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.errorCode, "ERR-1001");
});

test("GET /v1/issues and GET /v1/issues/{issueId} should return issue list and detail", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const payload = {
    projectKey: "order-service",
    eventId: `evt_issue_list_${Date.now()}`,
    sourceType: "log",
    traceId: "tr_issue_detail_1",
    payload: {
      message: "order api timeout",
      level: "error",
      service: "order-api",
      path: "/api/orders",
    },
  };

  const ingestRes = await fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(ingestRes.status, 202);
  const ingestBody = await ingestRes.json();
  assert.ok(ingestBody.issueId);
  assert.ok(instance.store.listIssues({}).length >= 1, JSON.stringify(instance.store.listIssues({})));
  assert.ok(
    instance.store.listIssues({ projectKey: "order-service" }).length >= 1,
    JSON.stringify(instance.store.listIssues({ projectKey: "order-service" })),
  );

  const listRes = await fetch(`${baseUrl}/v1/issues`);
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.ok, true);
  assert.ok(listBody.count >= 1, JSON.stringify(listBody));
  assert.ok(listBody.issues.some((item) => item.id === ingestBody.issueId));

  const filteredRes = await fetch(
    `${baseUrl}/v1/issues?projectKey=${encodeURIComponent(payload.projectKey)}&sourceType=${encodeURIComponent(payload.sourceType)}&limit=10`,
  );
  assert.equal(filteredRes.status, 200);
  const filteredBody = await filteredRes.json();
  assert.equal(filteredBody.ok, true);
  assert.ok(filteredBody.issues.some((item) => item.id === ingestBody.issueId), JSON.stringify(filteredBody));

  const detailRes = await fetch(`${baseUrl}/v1/issues/${encodeURIComponent(ingestBody.issueId)}`);
  assert.equal(detailRes.status, 200);
  const detailBody = await detailRes.json();
  assert.equal(detailBody.ok, true);
  assert.equal(detailBody.issue.id, ingestBody.issueId);
  assert.ok(Array.isArray(detailBody.timeline));
});

test("GET /v1/issues/{issueId} should return ERR-1003 when issue does not exist", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const res = await fetch(`${baseUrl}/v1/issues/issue_not_exists`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.errorCode, "ERR-1003");
});
