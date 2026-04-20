package com.example.tracelog;

import com.traceai.sdk.TraceContext;
import com.traceai.sdk.TraceLogClient;
import com.traceai.sdk.spring.boot.TraceLogWebFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class DemoController {
    private final TraceLogClient client;

    public DemoController(TraceLogClient client) {
        this.client = client;
    }

    @GetMapping("/orders/{id}")
    public Map<String, Object> getOrder(@PathVariable String id, HttpServletRequest request) {
        TraceContext trace = (TraceContext) request.getAttribute(TraceLogWebFilter.REQUEST_TRACE_ATTR);
        if (trace == null) {
            trace = client.startTrace(request.getHeader("x-trace-id"), request.getHeader("x-parent-span-id"));
        }

        try {
            if ("0".equals(id)) {
                throw new IllegalArgumentException("order not found");
            }
            return Map.of("ok", true, "id", id, "traceId", trace.traceId());
        } catch (Exception ex) {
            client.reportException(
                "get_order_failed",
                trace,
                ex,
                request.getRequestURI(),
                request.getMethod(),
                500,
                Map.of("orderId", id)
            );
            throw ex;
        }
    }
}
