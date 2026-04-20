import test from "node:test";
import assert from "node:assert/strict";

import { analyzeExceptionLogs } from "../src/core/analyzer.js";

test("analyzeExceptionLogs groups similar exceptions and emits bug report", () => {
  const logs = [
    {
      id: "log1",
      timestamp: "2026-04-14T10:00:00.000Z",
      level: "error",
      traceId: "tr_a",
      path: "/api/demo/fail",
      error: {
        name: "TypeError",
        message: "Cannot read properties of undefined (reading 'id')",
      },
      message: "downstream failed",
    },
    {
      id: "log2",
      timestamp: "2026-04-14T10:01:00.000Z",
      level: "error",
      traceId: "tr_b",
      path: "/api/demo/fail",
      error: {
        name: "TypeError",
        message: "Cannot read properties of undefined (reading 'name')",
      },
      message: "downstream failed",
    },
  ];

  const result = analyzeExceptionLogs(logs);

  assert.equal(result.totalErrorLogs, 2);
  assert.equal(result.bugReports.length, 1);
  assert.equal(result.bugReports[0].count, 2);
  assert.equal(result.bugReports[0].severity, "critical");
  assert.equal(result.bugReports[0].traceIds.length, 2);
  assert.match(result.bugReports[0].rootCauseHypothesis, /判空/);
});
