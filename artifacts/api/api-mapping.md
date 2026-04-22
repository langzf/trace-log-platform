# REQ 与 API 映射

| REQ ID | API |
|---|---|
| REQ-001 | `POST /v1/logs/frontend`, `POST /v1/logs/batch` |
| REQ-002 | `POST /v1/logs/backend`, `POST /v1/logs/batch` |
| REQ-003 | `GET /v1/traces`, `GET /v1/traces/{traceId}`, `GET /v1/logs` |
| REQ-004 | `POST /v1/analyze`, `POST /v1/system/analyzer/tick` |
| REQ-005 | `GET /v1/repair-tasks`, `POST /v1/repair-tasks/{taskId}/claim`, `PATCH /v1/repair-tasks/{taskId}` |
| REQ-006 | `/sdk/frontend.js`, `examples/frontend/*` |
| REQ-007 | `src/sdk/backend-sdk.js`, `examples/backend/*` |
| REQ-008 | `GET /v1/dashboard/full`, `public/*`, `npm test` |
| REQ-010 | `GET/POST /v1/config/executors` |
| REQ-011 | `GET /v1/system/queue/topics`, `POST /v1/system/queue/publish`, `POST /v1/system/queue/process-next`, `GET /v1/system/queue/dlq` |
| REQ-012 | queue envelope (`eventVersion`) via `POST /v1/system/queue/publish` and auto-publish hooks |
| REQ-016 | `GET /v1/audit-logs` |
| REQ-020 | `GET/POST /v1/config/projects`, `GET/POST /v1/config/model-policies` |
| REQ-021 | `GET /v1/system/openclaw/status`, `POST /v1/system/openclaw/install` |
