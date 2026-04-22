# OPS-003 - 代码变更清单(D6)

## 代码
- `scripts/openclaw/install_openclaw.sh`
  - 新增生产级安装器脚本
- `src/server.js`
  - OpenClaw 安装参数模型扩展
  - 默认安装脚本命令构建
  - 安装命令来源标记
  - status 接口增加 installer 信息
- `scripts/openclaw/one-click-install.js`
  - 增加结构化安装参数 CLI 透传
- `test/openclaw-system.test.js`
  - 覆盖默认安装脚本链路与失败分支

## 文档
- `README.md`
- `docs/deployment-runbook.md`
- `artifacts/api/openapi.yaml`
- `artifacts/ops-support-blueprint/api/openapi.yaml`

## 变更类型
- 功能增强（非破坏）
