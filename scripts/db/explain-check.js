import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DEFAULT_DB_PATH = path.join(ROOT_DIR, "data", "platform.db");

function parseArgs(argv) {
  const args = [...argv];
  let dbPath = DEFAULT_DB_PATH;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--db") {
      dbPath = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      return { help: true };
    }
    throw new Error(`unknown argument: ${token}`);
  }

  return { help: false, dbPath };
}

function runSql(dbPath, sql) {
  return execFileSync("sqlite3", ["-bail", dbPath, sql], { encoding: "utf8" });
}

function queryPlanText(dbPath, sql) {
  return execFileSync("sqlite3", [dbPath, `EXPLAIN QUERY PLAN ${sql}`], {
    encoding: "utf8",
  }).trim();
}

function ensureSeedData(dbPath) {
  runSql(
    dbPath,
    `
INSERT OR IGNORE INTO project(project_key, repo_url, default_branch, status, created_at, updated_at)
VALUES
  ('p-index-1', 'git@github.com:acme/p-index-1.git', 'main', 'active', datetime('now', '-10 minutes'), datetime('now', '-1 minutes')),
  ('p-index-2', 'git@github.com:acme/p-index-2.git', 'main', 'active', datetime('now', '-9 minutes'), datetime('now', '-2 minutes'));

INSERT OR IGNORE INTO issue(project_id, source_type, event_id, trace_id, session_id, user_id, status, created_at, updated_at)
SELECT project_id, 'log', 'evt-index-1', 'tr-index-1', 'sess-1', 'u-1', 'new', datetime('now', '-8 minutes'), datetime('now', '-1 minutes')
FROM project WHERE project_key = 'p-index-1';

INSERT OR IGNORE INTO executor_profile(executor_key, kind, endpoint, enabled, priority, created_at, updated_at)
VALUES ('exec-index-1', 'codex', 'http://127.0.0.1:18789/v1', 1, 10, datetime('now', '-7 minutes'), datetime('now', '-1 minutes'));

INSERT OR IGNORE INTO audit_log(audit_id, entity_type, entity_id, action, operator_type, operator_id, metadata_json, created_at)
VALUES ('audit-index-1', 'system', 'trace-log-platform', 'system.bootstrap', 'system', 'trace-log-platform', '{}', datetime('now', '-6 minutes'));
`,
  );
}

function assertPlanIncludes(dbPath, sql, expected) {
  const planText = queryPlanText(dbPath, sql);
  if (!planText.includes(expected)) {
    throw new Error(`query plan missing expected index "${expected}" for SQL: ${sql}\nplan=${planText}`);
  }
}

function assertPlanIncludesAny(dbPath, sql, expectedList) {
  const planText = queryPlanText(dbPath, sql);
  const ok = expectedList.some((name) => planText.includes(name));
  if (!ok) {
    throw new Error(`query plan missing expected indexes [${expectedList.join(", ")}] for SQL: ${sql}\nplan=${planText}`);
  }
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log("Usage: node scripts/db/explain-check.js [--db <path>]");
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  const { dbPath } = parsed;
  ensureSeedData(dbPath);

  assertPlanIncludes(
    dbPath,
    "SELECT project_key FROM project WHERE status='active' ORDER BY updated_at DESC LIMIT 5;",
    "idx_project_status_updated",
  );
  assertPlanIncludes(
    dbPath,
    "SELECT event_id FROM issue WHERE source_type='log' AND status='new' ORDER BY created_at DESC LIMIT 10;",
    "idx_issue_source_status_created",
  );
  assertPlanIncludesAny(
    dbPath,
    "SELECT executor_key FROM executor_profile WHERE kind='codex' AND enabled=1 ORDER BY priority ASC LIMIT 5;",
    ["idx_executor_kind_enabled_priority", "idx_executor_enabled_priority"],
  );
  assertPlanIncludes(
    dbPath,
    "SELECT audit_id FROM audit_log WHERE operator_type='system' AND operator_id='trace-log-platform' ORDER BY created_at DESC LIMIT 10;",
    "idx_audit_operator_time",
  );

  // eslint-disable-next-line no-console
  console.log("EXPLAIN_CHECK_OK");
}

try {
  main();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error.message || error);
  process.exitCode = 1;
}
