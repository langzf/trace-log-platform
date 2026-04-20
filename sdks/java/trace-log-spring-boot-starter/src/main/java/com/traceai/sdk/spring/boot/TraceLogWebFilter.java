package com.traceai.sdk.spring.boot;

import com.traceai.sdk.TraceContext;
import com.traceai.sdk.TraceLogClient;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

public class TraceLogWebFilter extends OncePerRequestFilter {
    public static final String REQUEST_TRACE_ATTR = "__trace_log_context";

    private final TraceLogClient client;

    public TraceLogWebFilter(TraceLogClient client) {
        this.client = client;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        TraceContext trace = client.startTrace(request.getHeader("x-trace-id"), request.getHeader("x-parent-span-id"));
        request.setAttribute(REQUEST_TRACE_ATTR, trace);
        response.setHeader("x-trace-id", trace.traceId());

        long start = System.currentTimeMillis();
        client.report("info", "request_start", trace, request.getRequestURI(), request.getMethod(), null, null, Map.of());

        try {
            filterChain.doFilter(request, response);
            client.report(
                "info",
                "request_end",
                trace,
                request.getRequestURI(),
                request.getMethod(),
                response.getStatus(),
                null,
                Map.of("durationMs", System.currentTimeMillis() - start)
            );
        } catch (Exception ex) {
            client.reportException(
                "request_error",
                trace,
                ex,
                request.getRequestURI(),
                request.getMethod(),
                500,
                Map.of("durationMs", System.currentTimeMillis() - start)
            );
            throw ex;
        }
    }
}
