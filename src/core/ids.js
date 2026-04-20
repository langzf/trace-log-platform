import crypto from "node:crypto";

export function generateId(prefix = "", bytes = 8) {
  const id = crypto.randomBytes(bytes).toString("hex");
  return prefix ? `${prefix}${id}` : id;
}

export function nowIso() {
  return new Date().toISOString();
}
