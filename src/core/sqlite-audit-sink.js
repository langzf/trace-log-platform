import { execFile } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export class SqliteAuditSink {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.ready = false;
  }

  async init() {
    if (this.ready) {
      return;
    }
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await execFileAsync("sqlite3", [
      "-bail",
      this.dbPath,
      `CREATE TABLE IF NOT EXISTS audit_log (
        audit_id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        operator_type TEXT NOT NULL CHECK (operator_type IN ('agent', 'human', 'system')),
        operator_id TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_entity_time ON audit_log(entity_type, entity_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_action_time ON audit_log(action, created_at);`,
    ]);
    this.ready = true;
  }

  async write(entry) {
    await this.init();
    const metadataJson = JSON.stringify(entry.metadata || {});
    const sql = `INSERT INTO audit_log(
      audit_id, entity_type, entity_id, action, operator_type, operator_id, metadata_json, created_at
    ) VALUES(
      ${sqlQuote(entry.id)},
      ${sqlQuote(entry.entityType)},
      ${sqlQuote(entry.entityId)},
      ${sqlQuote(entry.action)},
      ${sqlQuote(entry.operatorType)},
      ${sqlQuote(entry.operatorId)},
      ${sqlQuote(metadataJson)},
      ${sqlQuote(entry.createdAt)}
    );`;

    await execFileAsync("sqlite3", ["-bail", this.dbPath, sql]);
  }
}
