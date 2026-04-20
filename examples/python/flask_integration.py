"""Flask integration example based on pip package trace-log-sdk."""

from flask import Flask

from trace_log_sdk import TraceLogClient, install_flask_trace_logging


app = Flask(__name__)
trace_client = TraceLogClient(
    base_url="https://trace.example.com",
    service_name="flask-order-service",
)

install_flask_trace_logging(app, trace_client)


@app.get("/orders/<order_id>")
def get_order(order_id: str):
    if order_id == "0":
        raise ValueError("order not found")
    return {"ok": True, "orderId": order_id}


if __name__ == "__main__":
    app.run("0.0.0.0", 8000)
