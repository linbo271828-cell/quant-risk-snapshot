export type UxMode = "guided" | "advanced";

const MODE_KEY = "qrs-ux-mode";

export function getDefaultUxMode(): UxMode {
  if (typeof window === "undefined") return "guided";
  const raw = window.localStorage.getItem(MODE_KEY);
  return raw === "advanced" ? "advanced" : "guided";
}

export function setUxMode(mode: UxMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODE_KEY, mode);
}
