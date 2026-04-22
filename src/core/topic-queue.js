import { nowIso } from "./ids.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dlqTopic(topic) {
  return `ops.dlq.${topic}`;
}

export class InMemoryTopicQueue {
  constructor({ maxAttempts = 3 } = {}) {
    this.maxAttempts = maxAttempts;
    this.topics = new Map();
    this.dlq = new Map();
  }

  ensureTopic(topic) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, []);
    }
    if (!this.dlq.has(topic)) {
      this.dlq.set(topic, []);
    }
  }

  publish(topic, envelope) {
    this.ensureTopic(topic);
    const next = clone(envelope);
    if (!next.delivery || typeof next.delivery !== "object") {
      next.delivery = { attempt: 0, maxAttempts: this.maxAttempts };
    }
    if (next.delivery.maxAttempts === null || next.delivery.maxAttempts === undefined) {
      next.delivery.maxAttempts = this.maxAttempts;
    }
    this.topics.get(topic).push(next);
    return clone(next);
  }

  pull(topic, { limit = 1 } = {}) {
    this.ensureTopic(topic);
    const queue = this.topics.get(topic);
    const count = Math.max(0, Math.min(limit, queue.length));
    const out = queue.splice(0, count);
    return clone(out);
  }

  nack(topic, envelope, { reason = "unknown", maxAttempts } = {}) {
    this.ensureTopic(topic);
    const next = clone(envelope);
    const effectiveMax = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : this.maxAttempts;
    const attempt = (Number(next.delivery?.attempt) || 0) + 1;
    next.delivery = {
      ...(next.delivery || {}),
      attempt,
      maxAttempts: effectiveMax,
      lastError: reason,
      updatedAt: nowIso(),
    };

    if (attempt >= effectiveMax) {
      const dlqEnvelope = {
        ...next,
        deadLetter: {
          topic: dlqTopic(topic),
          reason,
          failedAt: nowIso(),
        },
      };
      this.dlq.get(topic).push(dlqEnvelope);
      return { movedToDlq: true, envelope: clone(dlqEnvelope) };
    }

    this.topics.get(topic).push(next);
    return { movedToDlq: false, envelope: clone(next) };
  }

  listTopics() {
    const rows = [];
    for (const [topic, queue] of this.topics.entries()) {
      const dlqDepth = (this.dlq.get(topic) || []).length;
      rows.push({
        topic,
        depth: queue.length,
        dlqTopic: dlqTopic(topic),
        dlqDepth,
      });
    }
    rows.sort((a, b) => a.topic.localeCompare(b.topic));
    return rows;
  }

  peekDlq(topic, { limit = 50 } = {}) {
    this.ensureTopic(topic);
    const queue = this.dlq.get(topic) || [];
    return clone(queue.slice(0, Math.max(0, limit)));
  }

  reset() {
    this.topics.clear();
    this.dlq.clear();
  }
}
