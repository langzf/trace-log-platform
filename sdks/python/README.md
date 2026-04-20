# trace-log-sdk (Python)

Python SDK for Trace Log Platform.

## Install

```bash
pip install trace-log-sdk
```

## Quick Start

```python
from trace_log_sdk import TraceLogClient

client = TraceLogClient(
    base_url="https://trace.example.com",
    service_name="python-order-service",
)

trace = client.new_trace()
client.report("info", "order_create_start", trace, path="/orders", method="POST")

try:
    raise TimeoutError("inventory timeout")
except Exception as exc:
    client.report_exception(
        message="order_create_failed",
        trace=trace,
        error=exc,
        path="/orders",
        method="POST",
        status_code=500,
        meta={"orderId": "ord_1001"},
    )

client.shutdown()
```
