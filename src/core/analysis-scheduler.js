import { analyzeExceptionLogs } from "./analyzer.js";

export class AnalysisScheduler {
  constructor({
    store,
    intervalMs = 60_000,
    minErrorCount = 1,
    maxAnalyzeLogs = 20_000,
  }) {
    this.store = store;
    this.intervalMs = intervalMs;
    this.minErrorCount = minErrorCount;
    this.maxAnalyzeLogs = maxAnalyzeLogs;
    this.timer = null;
    this.running = false;
  }

  snapshot() {
    return {
      enabled: Boolean(this.timer),
      intervalMs: this.intervalMs,
      minErrorCount: this.minErrorCount,
      running: this.running,
    };
  }

  async tick() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const logs = this.store.listLogs({ limit: this.maxAnalyzeLogs });
      const errorCount = logs.filter((log) => log.level === "error" || log.error).length;
      if (errorCount < this.minErrorCount) {
        return;
      }

      const result = analyzeExceptionLogs(logs);
      if (result.bugReports.length > 0) {
        await this.store.saveAnalysisResult(result);
      }
    } finally {
      this.running = false;
    }
  }

  start() {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.tick().catch(() => {
        // no-op, metrics are surfaced via dashboard
      });
    }, this.intervalMs);
  }

  stop() {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }
}
