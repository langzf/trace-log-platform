"""FastAPI integration example based on pip package trace-log-sdk."""

from fastapi import FastAPI

from trace_log_sdk import TraceLogClient, install_fastapi_trace_logging


app = FastAPI()
trace_client = TraceLogClient(
    base_url="https://trace.example.com",
    service_name="fastapi-payment-service",
)

install_fastapi_trace_logging(app, trace_client)


@app.get("/pay")
async def pay():
    return {"ok": True}
