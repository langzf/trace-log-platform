import assert from "node:assert/strict";
import test from "node:test";

import { startServer } from "../src/server.js";

test("OPTIONS preflight should return CORS headers", async () => {
  const instance = await startServer({
    port: 0,
    enableAutoAnalyze: false,
    enableCollectorScheduler: false,
  });

  try {
    const response = await fetch(`http://127.0.0.1:${instance.port}/v1/logs/batch`, {
      method: "OPTIONS",
      headers: {
        origin: "https://zqstud.yueying.cloud",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-client-app,x-trace-id,x-parent-span-id",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://zqstud.yueying.cloud");
    assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
    assert.match(response.headers.get("access-control-allow-headers") || "", /x-client-app/);
  } finally {
    await instance.close();
  }
});
