from __future__ import annotations

from time import perf_counter
from typing import Any

from .client import TraceLogClient


TRACE_STATE_ATTR = "trace_context"


def install_flask_trace_logging(app: Any, client: TraceLogClient) -> None:
    from flask import g, request

    @app.before_request
    def _trace_before_request() -> None:
        trace = client.from_headers(request.headers)
        setattr(g, TRACE_STATE_ATTR, trace)
        client.report("info", "request_start", trace, path=request.path, method=request.method)

    @app.after_request
    def _trace_after_request(response: Any):
        trace = getattr(g, TRACE_STATE_ATTR, None)
        if trace is not None:
            client.report(
                "info",
                "request_end",
                trace,
                path=request.path,
                method=request.method,
                status_code=response.status_code,
            )
        return response

    @app.teardown_request
    def _trace_teardown_request(error: BaseException | None) -> None:
        if error is None:
            return
        trace = getattr(g, TRACE_STATE_ATTR, None)
        if trace is not None:
            client.report_exception(
                message="request_error",
                trace=trace,
                error=error,
                path=request.path,
                method=request.method,
                status_code=500,
            )



def install_fastapi_trace_logging(app: Any, client: TraceLogClient) -> None:
    @app.middleware("http")
    async def _trace_middleware(request: Any, call_next: Any):
        trace = client.from_headers(request.headers)
        request.state.trace_context = trace
        start = perf_counter()

        client.report("info", "request_start", trace, path=request.url.path, method=request.method)

        try:
            response = await call_next(request)
        except Exception as exc:
            client.report_exception(
                message="request_error",
                trace=trace,
                error=exc,
                path=request.url.path,
                method=request.method,
                status_code=500,
                meta={"durationMs": int((perf_counter() - start) * 1000)},
            )
            raise

        client.report(
            "info",
            "request_end",
            trace,
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            meta={"durationMs": int((perf_counter() - start) * 1000)},
        )
        return response
