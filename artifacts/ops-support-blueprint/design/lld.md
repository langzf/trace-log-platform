# Low-Level Design (LLD)

## 1. 模块划分

### 1.1 Ingestion 模块
- `sdk-adapter`: 解析 SDK 上报协议。
- `event-normalizer`: 转换为统一事件模型。
- `idempotency-guard`: 幂等与去重。
- `event-producer`: 投递消息队列。

### 1.2 Intelligence 模块
- `classifier-worker`: 分类任务执行。
- `cluster-worker`: 相似度匹配和聚类。
- `priority-scorer`: 优先级与 SLA 计算。

### 1.3 Diagnosis 模块
- `context-fetcher`: 拉取日志、trace、代码索引。
- `evidence-builder`: 生成证据链。
- `diagnosis-runner`: 调用模型并生成结构化结论。

### 1.4 Repair Control 模块
- `task-orchestrator`: 状态机驱动。
- `model-router`: 模型分层与升级策略。
- `budget-guard`: max-turns/timeout/quota。
- `approval-gateway`: 人工审批与接管。

### 1.5 Executor 模块
- `executor-selector`: 执行器路由。
- `sandbox-runner`: worktree 隔离执行。
- `result-callback`: 回调任务结果。

### 1.6 Quality/Release 模块
- `gate-runner`: 测试与扫描。
- `release-controller`: 灰度发布控制。
- `rollback-controller`: 指标异常回滚。

### 1.7 Observability 模块
- `metrics-collector`: 指标采集。
- `audit-writer`: 审计写入。
- `retro-aggregator`: 复盘聚合和策略建议。

## 2. 状态机（RepairTask）
`queued -> diagnosing -> planned -> dispatching -> running -> pr_opened -> gate_checking -> waiting_review -> approved -> released -> completed`

失败路径：
- 任意状态可转 `failed`。
- 可重试状态：`diagnosing`, `dispatching`, `running`, `gate_checking`。
- 成本熔断转 `canceled_budget`。

## 3. 幂等策略
- 事件入站：`eventId` 唯一。
- 任务创建：`issueId + phase` 幂等键。
- 回调处理：`taskId + callbackSeq` 防重放。

## 4. 重试策略
- 外部调用指数退避：1s/2s/4s，最多 3 次。
- 执行器失败后可切换同优先级备选执行器。
- 达到失败阈值触发人工接管与升级通知。
