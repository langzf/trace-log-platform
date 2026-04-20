package com.traceai.sdk;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public final class TraceLogClient implements AutoCloseable {
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final LinkedBlockingDeque<Map<String, Object>> queue;
    private final ScheduledExecutorService scheduler;

    private final String baseUrl;
    private final String serviceName;
    private final String source;
    private final int batchSize;
    private final Duration requestTimeout;
    private final boolean failSilently;
    private final AtomicBoolean closed = new AtomicBoolean(false);

    private TraceLogClient(Builder builder) {
        this.httpClient = HttpClient.newBuilder().connectTimeout(builder.requestTimeout).build();
        this.objectMapper = new ObjectMapper();
        this.baseUrl = normalizeBaseUrl(builder.baseUrl);
        this.serviceName = builder.serviceName;
        this.source = builder.source;
        this.batchSize = builder.batchSize;
        this.requestTimeout = builder.requestTimeout;
        this.failSilently = builder.failSilently;
        this.queue = new LinkedBlockingDeque<>(builder.maxQueueSize);

        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "trace-log-flush");
            t.setDaemon(true);
            return t;
        });

        this.scheduler.scheduleWithFixedDelay(this::safeFlush,
            builder.flushInterval.toMillis(),
            builder.flushInterval.toMillis(),
            TimeUnit.MILLISECONDS);
    }

    public static Builder builder() {
        return new Builder();
    }

    public TraceContext startTrace(String incomingTraceId, String incomingParentSpanId) {
        String traceId = incomingTraceId != null && !incomingTraceId.isBlank() ? incomingTraceId : newId("tr", 24);
        return new TraceContext(traceId, newId("sp", 16), incomingParentSpanId, serviceName);
    }

    public TraceContext fromHeaders(Map<String, String> headers) {
        return startTrace(headers.get("x-trace-id"), headers.get("x-parent-span-id"));
    }

    public TraceContext childSpan(TraceContext parent) {
        return parent.childSpan(serviceName);
    }

    public void report(
        String level,
        String message,
        TraceContext trace,
        String path,
        String method,
        Integer statusCode,
        Throwable error,
        Map<String, Object> meta
    ) {
        if (closed.get()) {
            return;
        }

        TraceContext context = trace == null ? startTrace(null, null) : trace;

        Map<String, Object> payload = new HashMap<>();
        payload.put("traceId", context.traceId());
        payload.put("spanId", context.spanId());
        payload.put("parentSpanId", context.parentSpanId());
        payload.put("service", serviceName);
        payload.put("source", source);
        payload.put("level", level);
        payload.put("message", message);
        payload.put("path", path);
        payload.put("method", method);
        payload.put("statusCode", statusCode);
        payload.put("timestamp", Instant.now().toString());
        payload.put("meta", meta == null ? Map.of() : meta);
        payload.put("traceparent", "00-" + context.traceId() + "-" + context.spanId() + "-01");

        if (error != null) {
            payload.put("error", Map.of(
                "name", error.getClass().getSimpleName(),
                "message", error.getMessage() == null ? "" : error.getMessage(),
                "stack", ""
            ));
        }

        enqueue(payload);

        if (queue.size() >= batchSize) {
            flush();
        }
    }

    public void reportException(String message, TraceContext trace, Throwable error, String path,
                                String method, Integer statusCode, Map<String, Object> meta) {
        report("error", message, trace, path, method, statusCode, error, meta);
    }

    public void flush() {
        while (true) {
            List<Map<String, Object>> batch = new ArrayList<>(batchSize);
            queue.drainTo(batch, batchSize);
            if (batch.isEmpty()) {
                return;
            }
            postBatch(batch);
        }
    }

    @Override
    public void close() {
        if (!closed.compareAndSet(false, true)) {
            return;
        }

        scheduler.shutdown();
        try {
            scheduler.awaitTermination(2, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }

        safeFlush();
    }

    private void enqueue(Map<String, Object> payload) {
        if (!queue.offerLast(payload)) {
            queue.pollFirst();
            queue.offerLast(payload);
        }
    }

    private void safeFlush() {
        try {
            flush();
        } catch (RuntimeException ex) {
            if (!failSilently) {
                throw ex;
            }
        }
    }

    private void postBatch(List<Map<String, Object>> logs) {
        Map<String, Object> body = new HashMap<>();
        body.put("source", source);
        body.put("logs", logs);

        try {
            String json = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/v1/logs/batch"))
                .timeout(requestTimeout)
                .header("content-type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                throw new RuntimeException("Trace ingest failed status=" + response.statusCode());
            }
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            if (!failSilently) {
                throw new RuntimeException("Trace ingest failed", ex);
            }
        }
    }

    private static String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("baseUrl is required");
        }
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    static String newId(String prefix, int size) {
        StringBuilder buffer = new StringBuilder();
        while (buffer.length() < size) {
            buffer.append(UUID.randomUUID().toString().replace("-", ""));
        }
        return prefix + "_" + buffer.substring(0, size);
    }

    public static final class Builder {
        private String baseUrl;
        private String serviceName;
        private String source = "backend";
        private int batchSize = 30;
        private int maxQueueSize = 5000;
        private Duration flushInterval = Duration.ofSeconds(1);
        private Duration requestTimeout = Duration.ofSeconds(3);
        private boolean failSilently = true;

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder serviceName(String serviceName) {
            this.serviceName = serviceName;
            return this;
        }

        public Builder source(String source) {
            this.source = source;
            return this;
        }

        public Builder batchSize(int batchSize) {
            this.batchSize = Math.max(1, batchSize);
            return this;
        }

        public Builder maxQueueSize(int maxQueueSize) {
            this.maxQueueSize = Math.max(100, maxQueueSize);
            return this;
        }

        public Builder flushInterval(Duration flushInterval) {
            this.flushInterval = flushInterval == null ? Duration.ofSeconds(1) : flushInterval;
            return this;
        }

        public Builder requestTimeout(Duration requestTimeout) {
            this.requestTimeout = requestTimeout == null ? Duration.ofSeconds(3) : requestTimeout;
            return this;
        }

        public Builder failSilently(boolean failSilently) {
            this.failSilently = failSilently;
            return this;
        }

        public TraceLogClient build() {
            if (serviceName == null || serviceName.isBlank()) {
                throw new IllegalArgumentException("serviceName is required");
            }
            return new TraceLogClient(this);
        }
    }
}
