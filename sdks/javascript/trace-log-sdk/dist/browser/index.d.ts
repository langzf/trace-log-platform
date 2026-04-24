export type BrowserTraceContext = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  meta?: Record<string, unknown>;
};

export declare function createClient(options: {
  platformBaseUrl: string;
  appName?: string;
  flushIntervalMs?: number;
  batchSize?: number;
  autoCaptureErrors?: boolean;
}): {
  startTrace: (meta?: Record<string, unknown>) => BrowserTraceContext;
  childSpan: (traceContext: BrowserTraceContext, meta?: Record<string, unknown>) => BrowserTraceContext;
  log: (
    level: string,
    message: string,
    options?: {
      traceContext?: BrowserTraceContext;
      path?: string;
      method?: string;
      statusCode?: number;
      error?: unknown;
      meta?: Record<string, unknown>;
    },
  ) => Promise<void>;
  tracedFetch: (
    url: string | URL | Request,
    fetchOptions?: RequestInit,
    traceContext?: BrowserTraceContext | null,
  ) => Promise<{ response: Response; traceContext: BrowserTraceContext }>;
  flush: () => Promise<void>;
  shutdown: () => Promise<void>;
};

declare const _default: {
  createClient: typeof createClient;
};

export default _default;
