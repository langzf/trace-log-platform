export type TraceContext = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  service?: string;
  source?: string;
};

export type LogReportInput = {
  level?: string;
  message: string;
  traceContext?: TraceContext;
  error?: unknown;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  meta?: Record<string, unknown>;
  timestamp?: string;
};

export declare function createTraceContext(seed?: {
  traceId?: string;
  parentSpanId?: string | null;
  service?: string;
  source?: string;
}): TraceContext;

export declare function childSpan(traceContext: TraceContext, service?: string): TraceContext;

export declare function extractTraceHeaders(headers?: Record<string, unknown>): {
  traceId: string;
  parentSpanId: string;
  traceparent: string;
};

export declare function injectTraceHeaders(
  traceContext: TraceContext,
  additionalHeaders?: Record<string, string>,
): Record<string, string>;

export declare function createBackendLogClient(options: {
  platformBaseUrl: string;
  serviceName: string;
  source?: string;
  flushIntervalMs?: number;
  batchSize?: number;
  fetchImpl?: typeof fetch;
}): {
  report: (input: LogReportInput) => Promise<Record<string, unknown>>;
  flush: () => Promise<void>;
  shutdown: () => Promise<void>;
  createHttpRequestTracer: (reqHeaders?: Record<string, unknown>) => {
    traceContext: TraceContext;
    childSpan: () => TraceContext;
    outgoingHeaders: (additionalHeaders?: Record<string, string>) => Record<string, string>;
    reportStart: (meta?: Record<string, unknown>) => Promise<Record<string, unknown>>;
    reportError: (error: unknown, meta?: Record<string, unknown>) => Promise<Record<string, unknown>>;
    reportEnd: (meta?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  createTraceContext: (seed?: Record<string, unknown>) => TraceContext;
  childSpan: typeof childSpan;
};
