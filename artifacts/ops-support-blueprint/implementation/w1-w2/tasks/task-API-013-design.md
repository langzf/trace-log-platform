# API-013 - 任务设计(D1)

## 基本信息
- Task ID: API-013
- Owner: BE-1
- 日期: 2026-04-20
- 状态: Done

## 关联
- 关联需求: REQ-020
- 关联接口: `GET/POST /v1/config/projects`

## 变更目标
提供项目配置中心接口，用于维护 `projectKey -> repoUrl/defaultBranch` 映射，支持后续修复执行器按项目拉取仓库与分支。

## 变更范围
- In scope:
  - 新增项目配置持久化结构（`projects`）
  - 新增 `GET /v1/config/projects`
  - 新增 `POST /v1/config/projects` upsert
  - 支持按 `status` 过滤
- Out of scope:
  - 仓库凭据托管与加密
  - 分支保护与权限校验

## 风险与回退
- 风险：repoUrl/defaultBranch 填写错误会导致自动修复拉仓失败
- 回退方案：回退为静态项目清单配置
