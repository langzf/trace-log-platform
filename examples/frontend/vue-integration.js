// Vue 3 composition style integration
export function createTracePlugin(app) {
  const client = window.TraceLogSDK.createClient({
    platformBaseUrl: "https://trace.example.com",
    appName: "vue-web",
    flushIntervalMs: 1000,
    batchSize: 20,
  });

  app.config.globalProperties.$trace = client;

  app.mixin({
    beforeUnmount() {
      if (this === this.$root) {
        client.shutdown().catch(() => {});
      }
    },
  });
}

// Usage in component:
// const trace = this.$trace.startTrace({ page: "OrderPage" });
// await this.$trace.tracedFetch("/api/orders", { method: "POST", body: JSON.stringify(payload) }, trace);
