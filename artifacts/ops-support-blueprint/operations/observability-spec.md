# 可观测性规范

## 1. 指标
- 平台层：QPS、错误率、延迟、队列积压
- 任务层：state 分布、成功率、重试率、失败原因 TopN
- 模型层：tokens、调用轮次、平均耗时、路由命中率
- 发布层：门禁通过率、灰度通过率、回滚率

## 2. 日志
- 结构化 JSON 日志，字段至少包括：
  - ts, level, service, env, requestId, taskId, issueId, projectKey, message
- 严禁写入敏感明文（token/password）

## 3. 链路追踪
- 每个请求必须注入 traceId
- 跨服务透传 traceId 与 taskId
- 执行器回调必须回传原始 taskId

## 4. 审计
- 审计最小字段：entity_type/entity_id/action/operator_type/operator_id/metadata
- 审计事件不可覆盖，只能追加

## 5. 看板
- 大盘：MTTD、MTTR、成本、PR采纳率
- 运维盘：SLO、error budget、积压、故障趋势
- 研发盘：根因命中率、修复成功率、回归率
