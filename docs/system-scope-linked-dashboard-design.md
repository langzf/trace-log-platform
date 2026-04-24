# System Scope Linked Dashboard Design

## 目标

在多系统接入场景下，控制台支持选择“当前系统（projectKey）”，并让各页面联动到同一范围，避免跨系统数据混杂。

## 范围定义

- 系统范围主键：`projectKey`
- 关联服务来源：
  - 项目配置中的 `services`
  - Collector 配置中的 `projectKey -> service`
- 日志归属判定：
  - 优先 `log.meta.projectKey`
  - 其次按 `service` 是否属于该 `projectKey` 的服务集合

## 新增能力

### 后端

- 新增系统上下文接口：
  - `GET /v1/system/contexts`
  - 返回可切换系统列表、服务集合与窗口指标
- 新增/扩展 `projectKey` 过滤：
  - `GET /v1/dashboard/full`
  - `GET /v1/dashboard/overview`
  - `GET /v1/dashboard/error-trend`
  - `GET /v1/dashboard/services`
  - `GET /v1/dashboard/top-errors`
  - `GET /v1/services`
  - `GET /v1/traces`
  - `GET /v1/traces/{traceId}`
  - `GET /v1/logs`
  - `GET /v1/bugs`
  - `GET /v1/repair-tasks`
  - `POST /v1/analyze`（body 支持 `projectKey`）
- 项目配置扩展：
  - `POST /v1/config/projects` 支持 `services: string[]`

### 前端

- Header 增加系统选择器（全部/具体系统）
- Dashboard 按当前系统请求 `/v1/dashboard/full?projectKey=...`
- Traces/Bugs/Tasks/Collectors 查询自动附带 `projectKey`
- 手动分析仅分析当前系统范围
- 切换系统触发全页面刷新，保持统一数据上下文

## 数据一致性原则

- 统一由后端做范围过滤，前端不做二次猜测筛选
- Bug/Task 范围由其关联 trace/log 或显式 project 字段判定
- 无匹配服务或无归属元数据时，系统范围返回空集，避免误归属

## 验证

- 自动化测试：`test/system-scope-linkage.test.js`
- 重点验证：
  - Dashboard 服务数据按 projectKey 隔离
  - Traces 不跨系统混入
  - Analyze/Bugs/Tasks 支持按 projectKey 独立闭环
