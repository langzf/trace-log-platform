# OPS-003 - 测试记录(D4)

## 用例
- `GET /v1/system/openclaw/status` 返回 OpenClaw 探测信息与本地执行器
- `POST /v1/system/openclaw/install` dry-run 可同步注册 repair-receiver
- `POST /v1/system/openclaw/install` 在 real 模式下安装命令失败返回 `502/ERR-2001`

## 自动化测试
- 文件：`test/openclaw-system.test.js`
- 命令：`npm test -- --runInBand`
- 结果：通过

## 风险点
- 真实安装依赖外部制品源与本机权限；CI 中仅验证控制流与错误分支，不执行真实下载安装。
