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
    `trace-log-platform-db-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
  );
}

function runMigrate(args, dbPath) {
  return execFileSync(process.execPath, ["scripts/db/migrate.js", ...args, "--db", dbPath], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
}

function queryJson(dbPath, sql) {
  const out = execFileSync("sqlite3", ["-json", dbPath, sql], { encoding: "utf8" }).trim();
  if (!out) {
    return [];
  }
  return JSON.parse(out);
}

test("db migrate up/down should create and rollback DB-001/DB-007/DB-002/DB-008 tables", { concurrency: false }, () => {
  const dbPath = tempDbPath();

  runMigrate(["up"], dbPath);
  runMigrate(["up"], dbPath);

  const tables = queryJson(
    dbPath,
    `SELECT name FROM sqlite_master
     WHERE type='table' AND name IN ('schema_migrations', 'project', 'issue', 'cluster', 'executor_profile', 'audit_log', 'model_policy')
     ORDER BY name;`,
  ).map((row) => row.name);
  assert.deepEqual(tables, [
    "audit_log",
    "cluster",
    "executor_profile",
    "issue",
    "model_policy",
    "project",
    "schema_migrations",
  ]);

  const migrationCountAfterUp = queryJson(
    dbPath,
    "SELECT COUNT(*) AS c FROM schema_migrations;",
  )[0].c;
  assert.equal(migrationCountAfterUp, 5);

  runMigrate(["down", "--steps", "1"], dbPath);
  const remainingAfterOneRollback = queryJson(
    dbPath,
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('project', 'issue', 'cluster', 'executor_profile', 'audit_log', 'model_policy')
     ORDER BY name;`,
  ).map((row) => row.name);
  assert.deepEqual(remainingAfterOneRollback, ["audit_log", "cluster", "executor_profile", "issue", "project"]);

  runMigrate(["down", "--steps", "4"], dbPath);
  const remainingAfterAllRollbacks = queryJson(
    dbPath,
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('project', 'issue', 'cluster', 'executor_profile', 'audit_log', 'model_policy')
     ORDER BY name;`,
  ).map((row) => row.name);
  assert.deepEqual(remainingAfterAllRollbacks, []);

  const migrationCountAfterDown = queryJson(
    dbPath,
    "SELECT COUNT(*) AS c FROM schema_migrations;",
  )[0].c;
  assert.equal(migrationCountAfterDown, 0);
});
