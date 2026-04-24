# SDK Package Distribution Design

## Goal

让 `Integration Hub` 提供真实可下载、可安装的 SDK/Starter 包，而不是仅展示代码片段。

## Scope

- JavaScript: `@traceai/trace-log-sdk` npm tarball + browser runtime script
- Python: `trace-log-sdk` wheel
- Java: `trace-log-sdk` jar + `trace-log-spring-boot-starter` jar
- 平台页面展示包清单、下载入口、安装命令

## Build Pipeline

- 构建脚本：`scripts/build-sdk-packages.js`
- 输出目录：`public/packages`
- 清单文件：`public/packages/index.json`

构建步骤：

1. JavaScript
- 在 `sdks/javascript/trace-log-sdk` 执行 `npm pack`
- 复制 `src/sdk/frontend-sdk.js` 为 browser runtime 制品

2. Python
- 在 `sdks/python` 执行  
  `python3 -m pip wheel --no-build-isolation --no-deps . -w public/packages/python`

3. Java
- 在两个 Maven 模块执行 `mvn -q -DskipTests package`
- 提取 target 目录 jar 到 `public/packages/java`

4. 生成清单
- 每个文件记录 `downloadPath / sha256 / sizeBytes / contentType`
- 产出统一结构给前端渲染下载卡片

## Runtime Access

- 静态下载地址：
  - `/packages/javascript/*`
  - `/packages/python/*`
  - `/packages/java/*`
- 清单 API：`GET /v1/integration/packages`
  - 从 `public/packages/index.json` 读取
  - 返回绝对下载 URL（基于当前请求 host/proto）

## Integration Hub UI

- 保留接入代码片段区
- 新增 `SDK Package Registry` 区块：
  - 包名/版本/生态
  - 安装命令
  - 文件下载按钮
  - SHA256 与文件大小

## Ops Rule

- 发布前执行：`npm run sdk:package`
- 平台启动后可直接通过 Integration Hub 下载对应包
- 清单缺失时前端提示构建命令，不中断平台主流程
