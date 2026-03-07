/**
 * i18n for Quantis: English and Vietnamese only.
 * Standalone: use stored preference or browser language (en/vi fallback).
 * Embedded in AI Portal: use Portal locale (window.__AI_PORTAL_LOCALE__); if not en/vi, fall back to English.
 */

export type Locale = "en" | "vi"

const SUPPORTED: Locale[] = ["en", "vi"]
const STORAGE_KEY = "quantis-locale"

declare global {
  interface Window {
    __AI_PORTAL_LOCALE__?: string
  }
}

function isEmbedded(): boolean {
  try {
    return typeof window !== "undefined" && window.self !== window.top
  } catch {
    return false
  }
}

export function getLocale(): Locale {
  if (typeof window === "undefined") return "en"
  if (isEmbedded()) {
    const portal = (window as Window).__AI_PORTAL_LOCALE__
    const raw = (portal || "").toLowerCase().split(/[-_]/)[0]
    if (raw === "vi") return "vi"
    return "en"
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && SUPPORTED.includes(stored)) return stored
    const nav = (navigator.language || "").toLowerCase().split(/[-_]/)[0]
    if (nav === "vi") return "vi"
  } catch {
    /* ignore */
  }
  return "en"
}

export function setLocale(locale: Locale): void {
  if (!SUPPORTED.includes(locale)) return
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

const messages: Record<Locale, Record<string, string>> = {
  en: {},
  vi: {},
}

export function t(key: string): string {
  const locale = getLocale()
  const m = messages[locale][key] ?? messages.en[key]
  return m ?? key
}
