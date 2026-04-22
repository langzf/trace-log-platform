import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DEFAULT_DB_PATH = path.join(ROOT_DIR, "data", "platform.db");
const DEFAULT_MIGRATIONS_DIR = path.join(ROOT_DIR, "db", "migrations");

function parseArgs(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith("--") ? args.shift() : "up";

  const options = {
    db: DEFAULT_DB_PATH,
    dir: DEFAULT_MIGRATIONS_DIR,
    steps: 1,
  };

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--db") {
      options.db = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--dir") {
      options.dir = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--steps") {
      options.steps = Number(args[i + 1] || 1);
      i += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      return { help: true };
    }
    throw new Error(`unknown argument: ${token}`);
  }

  if (!["up", "down", "status"].includes(command)) {
    throw new Error(`unsupported command: ${command}`);
  }

  if (!Number.isInteger(options.steps) || options.steps <= 0) {
    throw new Error("steps must be a positive integer");
  }

  return { command, options, help: false };
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runSql(dbPath, sql) {
  execFileSync("sqlite3", ["-bail", dbPath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function queryJson(dbPath, sql) {
  const out = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (!out) {
    return [];
  }
  return JSON.parse(out);
}

async function ensureMeta(dbPath) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  runSql(
    dbPath,
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );`,
  );
}

async function loadMigrations(migrationsDir) {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const migrations = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (!/^\d+[_-].+/.test(entry.name)) {
      continue;
    }

    const migrationDir = path.join(migrationsDir, entry.name);
    const upPath = path.join(migrationDir, "up.sql");
    const downPath = path.join(migrationDir, "down.sql");
    const [upSql, downSql] = await Promise.all([
      fs.readFile(upPath, "utf8"),
      fs.readFile(downPath, "utf8"),
    ]);

    const [version] = entry.name.split(/[_-]/, 1);
    migrations.push({
      version,
      name: entry.name,
      upSql,
      downSql,
    });
  }

  migrations.sort((a, b) => Number(a.version) - Number(b.version));
  return migrations;
}

function listApplied(dbPath) {
  return queryJson(
    dbPath,
    "SELECT version, name, applied_at FROM schema_migrations ORDER BY CAST(version AS INTEGER) ASC;",
  );
}

function applyUp(dbPath, migration) {
  runSql(
    dbPath,
    `BEGIN;
${migration.upSql}
INSERT INTO schema_migrations(version, name, applied_at)
VALUES(${sqlQuote(migration.version)}, ${sqlQuote(migration.name)}, datetime('now'));
COMMIT;`,
  );
}

function applyDown(dbPath, migration) {
  runSql(
    dbPath,
    `BEGIN;
${migration.downSql}
DELETE FROM schema_migrations WHERE version = ${sqlQuote(migration.version)};
COMMIT;`,
  );
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  node scripts/db/migrate.js up [--db <path>] [--dir <path>]
  node scripts/db/migrate.js down [--db <path>] [--dir <path>] [--steps <n>]
  node scripts/db/migrate.js status [--db <path>] [--dir <path>]`);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  const { command, options } = parsed;
  await ensureMeta(options.db);
  const migrations = await loadMigrations(options.dir);
  const applied = listApplied(options.db);
  const appliedSet = new Set(applied.map((item) => item.version));

  if (command === "status") {
    for (const migration of migrations) {
      const state = appliedSet.has(migration.version) ? "APPLIED" : "PENDING";
      // eslint-disable-next-line no-console
      console.log(`${state} ${migration.version} ${migration.name}`);
    }
    return;
  }

  if (command === "up") {
    const pending = migrations.filter((migration) => !appliedSet.has(migration.version));
    for (const migration of pending) {
      applyUp(options.db, migration);
      // eslint-disable-next-line no-console
      console.log(`APPLIED ${migration.version} ${migration.name}`);
    }
    // eslint-disable-next-line no-console
    console.log(`DONE up (applied=${pending.length})`);
    return;
  }

  const appliedDesc = [...applied].sort((a, b) => Number(b.version) - Number(a.version));
  const targets = appliedDesc.slice(0, options.steps);
  for (const target of targets) {
    const migration = migrations.find((item) => item.version === target.version);
    if (!migration) {
      throw new Error(`missing migration files for version ${target.version}`);
    }
    applyDown(options.db, migration);
    // eslint-disable-next-line no-console
    console.log(`ROLLED_BACK ${migration.version} ${migration.name}`);
  }
  // eslint-disable-next-line no-console
  console.log(`DONE down (rolledBack=${targets.length})`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error.message || error);
  process.exitCode = 1;
});
