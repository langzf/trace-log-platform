import { useEffect, useMemo } from "react";

// Assumes /sdk/frontend.js is loaded globally, or adapt to your bundler import.
export function useTraceClient() {
  const client = useMemo(
    () =>
      window.TraceLogSDK.createClient({
        platformBaseUrl: "https://trace.example.com",
        appName: "react-web",
        flushIntervalMs: 1000,
        batchSize: 20,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      client.shutdown().catch(() => {});
    };
  }, [client]);

  return client;
}

export function CheckoutButton() {
  const client = useTraceClient();

  async function submitOrder() {
    const trace = client.startTrace({ scene: "checkout_submit" });

    await client.log("info", "checkout clicked", {
      traceContext: trace,
      meta: { feature: "checkout" },
    });

    const { response } = await client.tracedFetch(
      "https://api.example.com/orders",
      { method: "GET" },
      trace,
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "request failed");
    }
  }

  return <button onClick={submitOrder}>Submit Order</button>;
}
