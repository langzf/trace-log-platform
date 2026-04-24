import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { startServer } from "../src/server.js";

function tempPath(prefix, ext) {
  return path.join(os.tmpdir(), `trace-log-platform-${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
}

test("integration package api should return package catalog with download urls", { concurrency: false }, async (t) => {
  const dataFilePath = tempPath("data", ".json");
  const packageCatalogFilePath = tempPath("pkg-catalog", ".json");

  await fs.writeFile(
    packageCatalogFilePath,
    JSON.stringify(
      {
        schemaVersion: "v1",
        generatedAt: "2026-04-23T10:00:00.000Z",
        buildCommand: "npm run sdk:package",
        warnings: [],
        packages: [
          {
            key: "python-wheel",
            language: "python",
            ecosystem: "pip",
            packageName: "trace-log-sdk",
            version: "1.0.0",
            summary: "python sdk",
            installCommands: ["pip install <TRACE_PLATFORM_URL>/packages/python/trace_log_sdk-1.0.0-py3-none-any.whl"],
            files: [
              {
                fileName: "trace_log_sdk-1.0.0-py3-none-any.whl",
                relativePath: "packages/python/trace_log_sdk-1.0.0-py3-none-any.whl",
                downloadPath: "/packages/python/trace_log_sdk-1.0.0-py3-none-any.whl",
                sizeBytes: 12345,
                sha256: "abc123",
                contentType: "application/zip",
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const instance = await startServer({
    port: 0,
    dataFilePath,
    packageCatalogFilePath,
    enableAutoAnalyze: false,
    enableCollectorScheduler: false,
  });

  t.after(async () => {
    await instance.close();
    await fs.rm(packageCatalogFilePath, { force: true });
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const res = await fetch(`${baseUrl}/v1/integration/packages`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.ok, true);
  assert.equal(body.count, 1);
  assert.equal(body.packages[0].packageName, "trace-log-sdk");
  assert.equal(body.packages[0].files[0].downloadPath, "/packages/python/trace_log_sdk-1.0.0-py3-none-any.whl");
  assert.equal(
    body.packages[0].files[0].downloadUrl,
    `${baseUrl}/packages/python/trace_log_sdk-1.0.0-py3-none-any.whl`,
  );
});

test("integration package api should return empty payload when catalog is missing", { concurrency: false }, async (t) => {
  const dataFilePath = tempPath("data", ".json");
  const packageCatalogFilePath = tempPath("missing-catalog", ".json");

  const instance = await startServer({
    port: 0,
    dataFilePath,
    packageCatalogFilePath,
    enableAutoAnalyze: false,
    enableCollectorScheduler: false,
  });

  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const res = await fetch(`${baseUrl}/v1/integration/packages`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.ok, true);
  assert.equal(body.count, 0);
  assert.ok(Array.isArray(body.warnings));
  assert.ok(body.warnings[0].includes("Build packages first"));
});
