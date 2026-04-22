# Acceptance Criteria (Given/When/Then)

## REQ-001
Given 业务系统引入 SDK 并配置 endpoint
When 产生日志或用户反馈事件
Then 平台成功接收并写入标准事件模型，返回可追踪 eventId

## REQ-002
Given 同一用户会话跨前后端产生多个事件
When 查询 issue 详情
Then 可按 traceId/sessionId 聚合展示完整链路

## REQ-003
Given 相同 eventId 在 5 分钟内重复上报
When 触发接入流程
Then 仅产生一次有效处理任务，其他请求返回去重结果

## REQ-004
Given 用户反馈文本和上下文
When 执行分类任务
Then 输出主类、子类、有效性标记和置信度

## REQ-005
Given 新缺陷与历史缺陷集合
When 执行聚类任务
Then 输出 clusterId、相似度分值和阈值命中依据

## REQ-006
Given 问题频次、影响用户量和严重度
When 计算优先级
Then 输出 P0-P3 级别及对应处理 SLA

## REQ-007
Given 缺陷问题已聚类完成
When 执行诊断任务
Then 输出根因候选、证据链、置信度与建议动作

## REQ-008
Given 诊断任务复杂度高且预算充足
When 执行模型路由
Then 自动选择高能力模型；低复杂任务选择低成本模型

## REQ-009
Given RepairTask 因外部依赖失败
When 重试策略生效
Then 任务进入可重试状态并保留上次上下文，不重复创建新任务

## REQ-010
Given 同一仓库多个 issue 并发修复
When 调度执行器池
Then 每个任务使用独立 worktree 执行且无文件冲突

## REQ-011
Given 修复任务置信度达到自动修复阈值
When 修复执行完成
Then 自动提交分支并创建 PR，附带变更说明与关联 issue

## REQ-012
Given PR 已创建
When 执行质量门禁
Then 若测试或扫描失败则阻断进入发布阶段

## REQ-013
Given 变更进入灰度发布
When 关键指标恶化超过阈值
Then 自动回滚到上一个稳定版本

## REQ-014
Given 任务风险等级为高或置信度低
When 到达发布前阶段
Then 必须进入人工审批，不允许自动放行

## REQ-015
Given 平台连续运行
When 运维查看控制台
Then 可看到吞吐、成功率、时延、成本、失败分布

## REQ-016
Given 任一任务执行完成
When 查询审计日志
Then 能看到输入摘要、模型选择、工具调用、输出结果和操作者

## REQ-017
Given 任务失败或人工驳回
When 复盘任务触发
Then 输出结构化 retro 并记录可执行改进建议

## REQ-018
Given 单任务超过 tokens 或时长阈值
When 达到预算上限
Then 自动中断任务并标记为成本熔断

## REQ-019
Given 任务失败次数达到升级阈值
When 升级规则命中
Then 自动通知负责人并创建升级工单

## REQ-020
Given 新项目接入
When 管理员在配置中心登记仓库/执行器/策略
Then 新项目可被编排系统识别并参与自动流程

## REQ-021
Given OpenClaw 未安装或需升级
When 调用 `/v1/system/openclaw/install` 并提供结构化安装参数
Then 系统完成安装动作（或 dry-run 输出执行计划）、执行器自动注册并可被 repair-receiver 识别
