type TelemetryEvent = {
  name: string;
  at: string;
  meta?: Record<string, unknown>;
};

const KEY = "qrs-ux-telemetry";

export function trackEvent(name: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const payload: TelemetryEvent = { name, at: new Date().toISOString(), meta };
  try {
    const existing = window.localStorage.getItem(KEY);
    const list = existing ? (JSON.parse(existing) as TelemetryEvent[]) : [];
    list.push(payload);
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
  } catch {
    // Non-blocking: telemetry should never break UX flows.
  }
}
