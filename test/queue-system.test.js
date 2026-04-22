import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { startServer } from "../src/server.js";

function tempDataFile() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-queue-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

test("WRK queue should publish envelopes and route failed messages to DLQ", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
    queueMaxAttempts: 1,
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;

  const ingestRes = await fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: "queue-proj",
      eventId: `evt_queue_${Date.now()}`,
      sourceType: "log",
      payload: {
        message: "queue smoke event",
        level: "error",
        service: "queue-api",
      },
    }),
  });
  assert.equal(ingestRes.status, 202);

  const topicsRes = await fetch(`${baseUrl}/v1/system/queue/topics`);
  assert.equal(topicsRes.status, 200);
  const topicsBody = await topicsRes.json();
  assert.equal(topicsBody.ok, true);
  assert.ok(
    topicsBody.topics.some((item) => item.topic === "ops.events.issue.lifecycle" && item.depth >= 1),
    JSON.stringify(topicsBody),
  );

  const failProcessRes = await fetch(`${baseUrl}/v1/system/queue/process-next`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "ops.events.issue.lifecycle",
      fail: true,
      reason: "worker-crash",
    }),
  });
  assert.equal(failProcessRes.status, 200);
  const failProcessBody = await failProcessRes.json();
  assert.equal(failProcessBody.ok, true);
  assert.equal(failProcessBody.movedToDlq, true);
  assert.equal(failProcessBody.envelope.eventVersion, "v1");
  assert.equal(failProcessBody.envelope.envelopeVersion, "1.0");

  const dlqRes = await fetch(
    `${baseUrl}/v1/system/queue/dlq?topic=${encodeURIComponent("ops.events.issue.lifecycle")}`,
  );
  assert.equal(dlqRes.status, 200);
  const dlqBody = await dlqRes.json();
  assert.equal(dlqBody.ok, true);
  assert.equal(dlqBody.count, 1);
  assert.equal(dlqBody.items[0].deadLetter.reason, "worker-crash");
});

test("WRK queue APIs should validate topic and support manual envelope publish", { concurrency: false }, async (t) => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    dataFilePath: tempDataFile(),
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;

  const badRes = await fetch(`${baseUrl}/v1/system/queue/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "bad topic with space",
      eventType: "x",
      payload: {},
    }),
  });
  assert.equal(badRes.status, 400);
  const badBody = await badRes.json();
  assert.equal(badBody.ok, false);
  assert.equal(badBody.errorCode, "ERR-1001");

  const okRes = await fetch(`${baseUrl}/v1/system/queue/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "ops.events.manual",
      eventType: "manual.triggered",
      eventVersion: "v2",
      payload: {
        k: "v",
      },
    }),
  });
  assert.equal(okRes.status, 202);
  const okBody = await okRes.json();
  assert.equal(okBody.ok, true);
  assert.equal(okBody.topic, "ops.events.manual");
});
