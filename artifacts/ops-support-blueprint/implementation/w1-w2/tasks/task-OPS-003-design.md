# OPS-003 - 生产级 OpenClaw 安装器设计(D1)

## 背景
现有 OpenClaw 接入只支持命令透传，存在可维护性和可复用性不足问题。目标是提供默认可用的生产安装器，不依赖手写 shell。

## 设计目标
- 支持安装策略：`auto|brew|binary|bootstrap`
- 支持版本与制品参数：`targetVersion/binaryUrl/binarySha256`
- 支持安装目录与安装后命令
- 支持健康检查（可选）
- 保留 `installCommand` 透传作为兜底

## 实现点
- 新增脚本：`scripts/openclaw/install_openclaw.sh`
- 服务端结构化安装参数：`POST /v1/system/openclaw/install`
- 自动拼装安装命令，默认走脚本执行
- 安装状态接口补充 installer 默认配置：`GET /v1/system/openclaw/status`

## DoD
- 不传 `installCommand` 也可发起安装流程
- dry-run 可返回安装命令来源
- 测试覆盖 dry-run、同步注册、安装失败分支
