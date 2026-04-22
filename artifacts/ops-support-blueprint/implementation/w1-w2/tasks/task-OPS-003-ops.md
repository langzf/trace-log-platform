# OPS-003 - 运维实施说明(D5)

## 默认安装脚本
- 路径：`scripts/openclaw/install_openclaw.sh`
- 特性：
  - 安装策略选择（auto/brew/binary/bootstrap）
  - 目标版本控制
  - 二进制校验（SHA256）
  - 安装回滚（替换失败回退）
  - 可选健康检查与安装后命令

## 推荐部署参数
- `OPENCLAW_INSTALL_METHOD=binary`
- `OPENCLAW_BINARY_URL=<artifact-url>`
- `OPENCLAW_BINARY_SHA256=<sha256>`
- `OPENCLAW_TARGET_VERSION=<version>`
- `OPENCLAW_EXPECT_HEALTH=1`
- `OPENCLAW_POST_INSTALL_COMMAND=<start-or-restart-command>`

## 回滚策略
- 临时回滚：请求中显式传入旧版本 URL 与 SHA256 并 `forceReinstall=true`
- 永久回滚：将环境变量中的目标版本与制品地址切回上一稳定版本
