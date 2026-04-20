"""Python SDK usage example (package import only)."""

from trace_log_sdk import TraceLogClient


if __name__ == "__main__":
    client = TraceLogClient(
        base_url="https://trace.example.com",
        service_name="python-order-service",
        batch_size=20,
        flush_interval=0.8,
    )

    trace = client.new_trace()
    client.report("info", "create_order_start", trace, path="/orders", method="POST")

    try:
        raise TimeoutError("downstream inventory timeout")
    except Exception as exc:
        client.report_exception(
            message="create_order_failed",
            trace=trace,
            error=exc,
            path="/orders",
            method="POST",
            status_code=500,
            meta={"orderId": "ord_1001"},
        )

    client.shutdown()
