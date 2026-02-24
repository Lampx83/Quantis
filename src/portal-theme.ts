/**
 * Đồng bộ theme với AI Portal khi app nhúng trong iframe.
 */
const PORTAL_THEME_STORAGE = "portal-embed-theme";
const PORTAL_STORAGE_KEY = "neu-ui-theme";

export type ResolvedTheme = "light" | "dark";

function resolveFromSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getPortalTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  const win = window as unknown as { __PORTAL_THEME__?: string };
  if (win.__PORTAL_THEME__ === "dark" || win.__PORTAL_THEME__ === "light") return win.__PORTAL_THEME__;
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("theme")?.toLowerCase();
    if (q === "dark" || q === "light") return q;
    const stored = localStorage.getItem(PORTAL_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    if (stored === "system") return resolveFromSystem();
    const embedStored = localStorage.getItem(PORTAL_THEME_STORAGE);
    if (embedStored === "dark" || embedStored === "light") return embedStored;
  } catch {
    /* ignore */
  }
  return resolveFromSystem();
}

export function applyPortalTheme(value: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(value);
  try {
    localStorage.setItem(PORTAL_THEME_STORAGE, value);
  } catch {
    /* ignore */
  }
}

export function initPortalTheme(): void {
  const theme = getPortalTheme();
  applyPortalTheme(theme);
  if (typeof window === "undefined") return;
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key === PORTAL_STORAGE_KEY && e.newValue) {
      const v = e.newValue === "dark" || e.newValue === "light" ? e.newValue : e.newValue === "system" ? resolveFromSystem() : null;
      if (v) applyPortalTheme(v);
    }
  });
  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; theme?: string } | null;
    if (data?.type === "portal-theme" && (data.theme === "dark" || data.theme === "light")) {
      applyPortalTheme(data.theme);
    }
  });
}
