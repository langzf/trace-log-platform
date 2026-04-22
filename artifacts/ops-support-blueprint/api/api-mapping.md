# Requirement to API Mapping

| REQ ID | API Operation |
|---|---|
| REQ-001 | `POST /v1/events` |
| REQ-002 | `GET /v1/issues/{issueId}` |
| REQ-003 | `POST /v1/events` + Idempotency-Key |
| REQ-004 | `GET /v1/issues` (category fields) |
| REQ-005 | `GET /v1/issues` (clusterId fields) |
| REQ-006 | `GET /v1/issues` (priority filters) |
| REQ-007 | `POST /v1/issues/{issueId}/diagnose`, `GET /v1/diagnoses/{diagnosisId}` |
| REQ-008 | `POST /v1/repair-tasks` (modelTier) |
| REQ-009 | `GET /v1/repair-tasks/{taskId}`, `POST /v1/repair-tasks/{taskId}/dispatch` |
| REQ-010 | `GET/POST /v1/config/executors` |
| REQ-011 | `GET /v1/patch-prs/{patchId}` |
| REQ-012 | `GET /v1/patch-prs/{patchId}` + gate 状态字段 |
| REQ-013 | `POST /v1/releases/{releaseId}/rollback` |
| REQ-014 | `POST /v1/repair-tasks` (riskLevel) + 人工审批流程接口(扩展) |
| REQ-015 | `GET /v1/metrics/overview` |
| REQ-016 | 审计查询接口(扩展 `GET /v1/audits`) |
| REQ-017 | 复盘接口(扩展 `GET /v1/retros/{taskId}`) |
| REQ-018 | `POST /v1/repair-tasks` (budget/max-turns via policy) |
| REQ-019 | 通知接口(扩展 `POST /v1/alerts/escalate`) |
| REQ-020 | `GET/POST /v1/config/projects`, `GET/POST /v1/config/executors`, `GET/POST /v1/config/model-policies` |
| REQ-021 | `GET /v1/system/openclaw/status`, `POST /v1/system/openclaw/install` |
