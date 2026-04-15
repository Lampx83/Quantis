/**
 * Embed config: basePath and embedPath set by Portal at install time.
 */

declare global {
  interface Window {
    __PORTAL_BASE_PATH__?: string;
  }
}

/** Khi embed-config.json tải xong (Portal pack), để App re-chạy auth / nhận diện embed. */
export const QUANTIS_EMBED_CONFIG_EVENT = "quantis-embed-config-loaded";

let cached: { basePath: string; embedPath: string } | null = null;

export function getPortalBasePath(): string {
  if (typeof window === "undefined") return "";
  if (window.__PORTAL_BASE_PATH__) return window.__PORTAL_BASE_PATH__.replace(/\/+$/, "");
  if (cached?.basePath) return cached.basePath;
  return "";
}

export function getEmbedPath(): string {
  if (typeof window === "undefined") return "";
  if (cached?.embedPath) return cached.embedPath;
  const base = getPortalBasePath();
  if (!base) return "";
  return `${base}/embed/quantis`;
}

export function loadEmbedConfig(): Promise<{ basePath: string; embedPath: string } | null> {
  if (cached) return Promise.resolve(cached);
  if (typeof window === "undefined") return Promise.resolve(null);
  return fetch("embed-config.json", { credentials: "include" })
    .then((r) => (r.ok ? r.json() : null))
    .then((config: { basePath?: string; embedPath?: string } | null) => {
      if (config?.basePath !== undefined) {
        cached = {
          basePath: String(config.basePath ?? "").replace(/\/+$/, ""),
          embedPath: config.embedPath ? String(config.embedPath).replace(/\/+$/, "") : "",
        };
        if (typeof window !== "undefined" && cached.basePath && !window.__PORTAL_BASE_PATH__) {
          window.__PORTAL_BASE_PATH__ = cached.basePath;
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(QUANTIS_EMBED_CONFIG_EVENT, { detail: cached }));
        }
        return cached;
      }
      return null;
    })
    .catch(() => null);
}
