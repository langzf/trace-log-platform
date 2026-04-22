# OPS-003 - API变更说明(D3)

## 变更接口
- `GET /v1/system/openclaw/status`
  - 新增 `installer` 字段，返回默认安装脚本路径与默认参数配置
- `POST /v1/system/openclaw/install`
  - 新增结构化参数：
    - `installMode` (`auto|brew|binary|bootstrap`)
    - `targetVersion`
    - `binaryUrl`
    - `binarySha256`
    - `bootstrapUrl`
    - `installDir`
    - `expectHealth`
    - `postInstallCommand`

## 兼容策略
- 向后兼容 `installCommand`：
  - 若传入 `installCommand`，优先按透传命令执行
  - 若未传入，自动构建默认安装脚本命令

## 错误码
- `ERR-1001`：安装参数不合法（如 `installMode=binary` 但缺少 `binaryUrl`）
- `ERR-2001`：安装命令执行失败
