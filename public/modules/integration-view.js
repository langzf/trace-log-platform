const SNIPPETS = {
  javascript: `// Browser SDK
const client = window.TraceLogSDK.createClient({
  platformBaseUrl: "https://trace.example.com",
  appName: "checkout-web",
});

const trace = client.startTrace({ feature: "checkout" });
await client.tracedFetch("https://api.example.com/orders", { method: "POST" }, trace);`,
  python: `# Install package
# pip install trace-log-sdk

from trace_log_sdk import TraceLogClient

client = TraceLogClient(
    base_url="https://trace.example.com",
    service_name="python-order-service",
    batch_size=30,
)

trace = client.new_trace()
client.report("info", "create_order_start", trace, path="/orders", method="POST")`,
  java: `<!-- pom.xml -->
<dependency>
  <groupId>com.traceai</groupId>
  <artifactId>trace-log-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>

# application.yml
trace:
  log:
    platform-base-url: https://trace.example.com
    service-name: java-order-service

// Controller usage
TraceContext trace =
  (TraceContext) request.getAttribute(TraceLogWebFilter.REQUEST_TRACE_ATTR);`,
  curl: `# Fallback only (not recommended for app integration)
curl -X POST https://trace.example.com/v1/logs/backend \\
  -H 'content-type: application/json' \\
  -d '{
    "traceId": "tr_curl_1",
    "spanId": "sp_curl_1",
    "level": "error",
    "message": "payment failed",
    "service": "payment-service"
  }'`,
};

function switchLang(lang) {
  const snippetNode = document.getElementById("integration-snippet");
  snippetNode.textContent = SNIPPETS[lang] || SNIPPETS.javascript;

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
  });
}

export function mountIntegrationModule() {
  const tabs = document.getElementById("integration-tabs");
  tabs.addEventListener("click", (event) => {
    const target = event.target;
    if (!target.classList.contains("lang-btn")) {
      return;
    }
    switchLang(target.getAttribute("data-lang"));
  });

  switchLang("javascript");
}
