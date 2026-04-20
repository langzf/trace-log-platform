package com.traceai.sdk;

import java.util.HashMap;
import java.util.Map;

public record TraceContext(String traceId, String spanId, String parentSpanId, String service) {
    public Map<String, String> asHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("x-trace-id", traceId);
        headers.put("x-parent-span-id", spanId);
        headers.put("traceparent", "00-" + traceId + "-" + spanId + "-01");
        return headers;
    }

    public TraceContext childSpan(String fallbackService) {
        return new TraceContext(traceId, TraceLogClient.newId("sp", 16), spanId,
            service == null || service.isBlank() ? fallbackService : service);
    }
}
