# 步骤-文档交付矩阵（强制）

## 1. 原则
每个开发任务必须同时交付“代码 + 文档”。任何缺失文档的任务不得进入合并评审。

## 2. 文档类型定义
- `D1 任务设计`：目标、范围、接口/表影响、风险。
- `D2 数据变更说明`：DDL、索引、回滚方案。
- `D3 API 变更说明`：OpenAPI diff、错误码、兼容性。
- `D4 测试说明`：用例、结果、覆盖范围。
- `D5 运维说明`：告警、指标、排障、回退步骤。
- `D6 变更记录`：变更摘要、负责人、时间、影响。

## 3. 任务映射（W1-W2）

| Task ID | 必交文档 | 文档路径 |
|---|---|---|
| API-001 | D1 D3 D4 D6 | `implementation/w1-w2/` |
| API-002 | D1 D3 D4 D6 | `implementation/w1-w2/` |
| API-003 | D1 D3 D4 D6 | `implementation/w1-w2/` |
| API-004 | D1 D3 D4 D6 | `implementation/w1-w2/` |
| API-012 | D1 D3 D4 D6 | `implementation/w1-w2/` |
| API-013 | D1 D3 D4 D6 | `implementation/w1-w2/` |
| DB-001 | D1 D2 D4 D6 | `implementation/w1-w2/` |
| DB-002 | D1 D2 D4 D6 | `implementation/w1-w2/` |
| DB-007 | D1 D2 D4 D6 | `implementation/w1-w2/` |
| DB-008 | D1 D2 D4 D6 | `implementation/w1-w2/` |
| DB-009 | D1 D2 D4 D6 | `implementation/w1-w2/` |
| WRK-001 | D1 D5 D6 | `implementation/w1-w2/` |
| WRK-002 | D1 D5 D6 | `implementation/w1-w2/` |
| WRK-003 | D1 D4 D5 D6 | `implementation/w1-w2/` |
| OBS-001 | D1 D5 D6 | `implementation/w1-w2/` |

## 4. 命名规范
- 任务设计：`task-<TaskID>-design.md`
- 数据变更：`task-<TaskID>-db.md`
- API变更：`task-<TaskID>-api.md`
- 测试说明：`task-<TaskID>-test.md`
- 运维说明：`task-<TaskID>-ops.md`
- 变更记录统一追加：`implementation/w1-w2/change-log.md`
