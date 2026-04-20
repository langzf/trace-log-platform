# Deployment Runbook

## 1. 环境要求

- Node.js >= 20
- Linux/macOS

## 2. 环境变量

参考 `.env.example`：
- `PORT` 服务端口
- `HOST` 监听地址
- `AUTO_ANALYZE` 是否自动分析
- `ANALYZE_INTERVAL_MS` 自动分析间隔

## 3. 启动

```bash
npm start
```

## 4. 健康检查

```bash
curl -sS http://127.0.0.1:3000/health
```

## 5. 发布前检查

```bash
npm test
npm run smoke
```

## 6. 运行中操作

- 暂停自动分析：`POST /v1/system/analyzer/stop`
- 恢复自动分析：`POST /v1/system/analyzer/start`
- 手工执行分析：`POST /v1/analyze`

## 7. 失败排查

- 看板打不开：检查 `/health` 和端口监听
- 无任务产出：先确认有 error 日志，再触发 `/v1/analyze`
- trace 串不起来：检查请求头是否传递 `x-trace-id` 与 `x-parent-span-id`
