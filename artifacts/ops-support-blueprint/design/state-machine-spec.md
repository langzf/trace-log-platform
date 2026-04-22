# RepairTask 状态机规格

## 1. 状态定义
- `queued`
- `diagnosing`
- `planned`
- `dispatching`
- `running`
- `pr_opened`
- `gate_checking`
- `waiting_review`
- `approved`
- `released`
- `completed`
- `failed`
- `canceled_budget`
- `canceled_manual`

## 2. 迁移规则
- `queued -> diagnosing|planned`
- `diagnosing -> planned|failed|canceled_budget`
- `planned -> dispatching|canceled_manual`
- `dispatching -> running|failed|canceled_budget`
- `running -> pr_opened|failed|canceled_budget`
- `pr_opened -> gate_checking|waiting_review`
- `gate_checking -> waiting_review|failed`
- `waiting_review -> approved|failed|canceled_manual`
- `approved -> released|failed`
- `released -> completed|failed`

## 3. 非法迁移处理
- 返回 `ERR-1004`
- 写入审计日志 `state_transition_rejected`

## 4. 重试语义
- 可重试状态：`diagnosing`, `dispatching`, `running`, `gate_checking`
- 最大重试次数默认 3，可按项目配置覆盖。

## 5. 终态
- `completed`, `failed`, `canceled_budget`, `canceled_manual`
