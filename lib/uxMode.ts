export type UxMode = "guided" | "advanced";

const MODE_KEY = "qrs-ux-mode";
const MODE_EVENT = "qrs-ux-mode-change";

export function getDefaultUxMode(): UxMode {
  if (typeof window === "undefined") return "guided";
  const raw = window.localStorage.getItem(MODE_KEY);
  return raw === "advanced" ? "advanced" : "guided";
}

export function setUxMode(mode: UxMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: mode }));
}

export function subscribeUxMode(listener: (mode: UxMode) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onModeChange = (evt: Event) => {
    const custom = evt as CustomEvent<UxMode>;
    listener(custom.detail === "advanced" ? "advanced" : "guided");
  };
  window.addEventListener(MODE_EVENT, onModeChange);
  return () => window.removeEventListener(MODE_EVENT, onModeChange);
}
