import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function tempDbPath() {
  return path.join(
    os.tmpdir(),
    `trace-log-platform-explain-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
  );
}

test("db explain check should verify high-frequency query plans", { concurrency: false }, () => {
  const dbPath = tempDbPath();

  execFileSync(process.execPath, ["scripts/db/migrate.js", "up", "--db", dbPath], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });

  const out = execFileSync(process.execPath, ["scripts/db/explain-check.js", "--db", dbPath], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  }).trim();

  assert.equal(out, "EXPLAIN_CHECK_OK");
});
