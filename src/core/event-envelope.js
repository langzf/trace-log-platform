import { generateId, nowIso } from "./ids.js";

const TOPIC_RE = /^[a-zA-Z0-9._-]+$/;

export function validateTopic(topic) {
  const normalized = String(topic || "").trim();
  if (!normalized) {
    throw new Error("topic is required");
  }
  if (!TOPIC_RE.test(normalized)) {
    throw new Error("topic contains invalid characters");
  }
  return normalized;
}

export function validateEventEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    throw new Error("envelope must be an object");
  }

  const required = [
    "id",
    "envelopeVersion",
    "eventVersion",
    "topic",
    "eventType",
    "producer",
    "timestamp",
    "payload",
  ];
  for (const key of required) {
    if (envelope[key] === undefined || envelope[key] === null || envelope[key] === "") {
      throw new Error(`envelope.${key} is required`);
    }
  }

  validateTopic(envelope.topic);

  if (typeof envelope.payload !== "object" || Array.isArray(envelope.payload)) {
    throw new Error("envelope.payload must be an object");
  }

  return true;
}

export function buildEventEnvelope({
  topic,
  eventType,
  payload,
  eventVersion = "v1",
  envelopeVersion = "1.0",
  producer = "trace-log-platform",
  traceId = null,
  correlationId = null,
  metadata = {},
} = {}) {
  const envelope = {
    id: generateId("evt_", 8),
    envelopeVersion,
    eventVersion,
    topic: validateTopic(topic),
    eventType: String(eventType || "").trim(),
    producer,
    timestamp: nowIso(),
    traceId,
    correlationId,
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {},
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {},
    delivery: {
      attempt: 0,
      maxAttempts: null,
    },
  };

  validateEventEnvelope(envelope);
  return envelope;
}
