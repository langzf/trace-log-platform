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
