import os from "node:os";
import path from "node:path";

import { startServer } from "../src/server.js";

async function run() {
  const dataFilePath = path.join(
    os.tmpdir(),
    `trace-log-platform-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );

  const instance = await startServer({ port: 0, dataFilePath });
  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const traceId = `tr_smoke_${Date.now()}`;

  try {
    await fetch(`${baseUrl}/v1/logs/frontend`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        traceId,
        spanId: "sp_smoke_front",
        level: "info",
        message: "smoke-test frontend click",
        path: "/smoke",
      }),
    });

    await fetch(`${baseUrl}/api/simulate/fail`, {
      headers: {
        "x-trace-id": traceId,
        "x-parent-span-id": "sp_smoke_front",
      },
    });

    const analysisRes = await fetch(`${baseUrl}/v1/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const analysis = await analysisRes.json();
    const taskRes = await fetch(`${baseUrl}/v1/repair-tasks`);
    const tasks = await taskRes.json();

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: true,
          traceId,
          bugCount: analysis.bugCount,
          repairTaskCount: tasks.count,
          sampleTask: tasks.tasks[0] || null,
        },
        null,
        2,
      ),
    );
  } finally {
    await instance.close();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
