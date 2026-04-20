from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from queue import Empty, Queue
import json
import threading
import time
from typing import Any, Dict, Mapping, Optional
import urllib.error
import urllib.request
import uuid


DEFAULT_SOURCE = "backend"


@dataclass(frozen=True)
class TraceContext:
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    service: Optional[str] = None

    def as_headers(self) -> Dict[str, str]:
        headers = {
            "x-trace-id": self.trace_id,
            "x-parent-span-id": self.span_id,
            "traceparent": f"00-{self.trace_id}-{self.span_id}-01",
        }
        return headers


class TraceLogClient:
    def __init__(
        self,
        *,
        base_url: str,
        service_name: str,
        source: str = DEFAULT_SOURCE,
        batch_size: int = 30,
        flush_interval: float = 1.0,
        queue_size: int = 5000,
        request_timeout: float = 3.0,
        fail_silently: bool = True,
    ) -> None:
        if not base_url:
            raise ValueError("base_url is required")
        if not service_name:
            raise ValueError("service_name is required")

        self._base_url = base_url.rstrip("/")
        self._service_name = service_name
        self._source = source
        self._batch_size = max(1, batch_size)
        self._flush_interval = max(0.2, flush_interval)
        self._request_timeout = max(0.1, request_timeout)
        self._fail_silently = fail_silently

        self._queue: Queue[Dict[str, Any]] = Queue(maxsize=max(100, queue_size))
        self._stop = threading.Event()
        self._flush_lock = threading.Lock()
        self._worker = threading.Thread(target=self._run_flush_loop, daemon=True)
        self._worker.start()

    @property
    def service_name(self) -> str:
        return self._service_name

    def new_trace(
        self,
        incoming_trace_id: Optional[str] = None,
        incoming_parent_span_id: Optional[str] = None,
    ) -> TraceContext:
        trace_id = incoming_trace_id if incoming_trace_id else _new_id("tr", 24)
        return TraceContext(
            trace_id=trace_id,
            span_id=_new_id("sp", 16),
            parent_span_id=incoming_parent_span_id,
            service=self._service_name,
        )

    def from_headers(self, headers: Mapping[str, str]) -> TraceContext:
        return self.new_trace(
            incoming_trace_id=headers.get("x-trace-id"),
            incoming_parent_span_id=headers.get("x-parent-span-id"),
        )

    def child_span(self, parent: TraceContext) -> TraceContext:
        return TraceContext(
            trace_id=parent.trace_id,
            span_id=_new_id("sp", 16),
            parent_span_id=parent.span_id,
            service=self._service_name,
        )

    def report(
        self,
        level: str,
        message: str,
        trace: TraceContext,
        *,
        path: Optional[str] = None,
        method: Optional[str] = None,
        status_code: Optional[int] = None,
        error: Optional[BaseException] = None,
        meta: Optional[Dict[str, Any]] = None,
        timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "traceId": trace.trace_id,
            "spanId": trace.span_id,
            "parentSpanId": trace.parent_span_id,
            "service": self._service_name,
            "source": self._source,
            "level": level,
            "message": message,
            "path": path,
            "method": method,
            "statusCode": status_code,
            "timestamp": timestamp or _now_iso(),
            "meta": meta or {},
            "traceparent": f"00-{trace.trace_id}-{trace.span_id}-01",
        }

        if error is not None:
            payload["error"] = {
                "name": error.__class__.__name__,
                "message": str(error),
                "stack": "",
            }

        self._enqueue(payload)
        if self._queue.qsize() >= self._batch_size:
            self.flush()
        return payload

    def report_exception(
        self,
        *,
        message: str,
        trace: TraceContext,
        error: BaseException,
        path: Optional[str] = None,
        method: Optional[str] = None,
        status_code: Optional[int] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.report(
            "error",
            message,
            trace,
            path=path,
            method=method,
            status_code=status_code,
            error=error,
            meta=meta,
        )

    def flush(self) -> None:
        with self._flush_lock:
            while True:
                logs = self._drain_batch(self._batch_size)
                if not logs:
                    return
                self._post_batch(logs)

    def shutdown(self, *, flush: bool = True, wait_timeout: float = 2.0) -> None:
        self._stop.set()
        self._worker.join(timeout=wait_timeout)
        if flush:
            self.flush()

    def __enter__(self) -> "TraceLogClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self.shutdown(flush=True)

    def _enqueue(self, payload: Dict[str, Any]) -> None:
        try:
            self._queue.put_nowait(payload)
        except Exception:
            try:
                _ = self._queue.get_nowait()
            except Empty:
                pass
            try:
                self._queue.put_nowait(payload)
            except Exception:
                if not self._fail_silently:
                    raise

    def _run_flush_loop(self) -> None:
        while not self._stop.is_set():
            time.sleep(self._flush_interval)
            try:
                self.flush()
            except Exception:
                if not self._fail_silently:
                    raise

    def _drain_batch(self, size: int) -> list[Dict[str, Any]]:
        logs: list[Dict[str, Any]] = []
        for _ in range(size):
            try:
                logs.append(self._queue.get_nowait())
            except Empty:
                break
        return logs

    def _post_batch(self, logs: list[Dict[str, Any]]) -> None:
        body = json.dumps({"source": self._source, "logs": logs}).encode("utf-8")
        request = urllib.request.Request(
            url=f"{self._base_url}/v1/logs/batch",
            data=body,
            method="POST",
            headers={"content-type": "application/json"},
        )

        try:
            with urllib.request.urlopen(request, timeout=self._request_timeout) as response:
                if response.status >= 300:
                    raise RuntimeError(f"Trace ingest failed with status={response.status}")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            if not self._fail_silently:
                raise RuntimeError(f"Trace ingest failed: {exc}") from exc



def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")



def _new_id(prefix: str, size: int) -> str:
    raw = uuid.uuid4().hex
    while len(raw) < size:
        raw += uuid.uuid4().hex
    return f"{prefix}_{raw[:size]}"
