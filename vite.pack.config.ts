/**
 * Build config used only when packaging the app for AI Portal.
 *
 * The normal build writes into `public/`, which is also Vite's default
 * publicDir. Building to any other outDir therefore copies the previous
 * build's `public/assets/*` in as if they were static files, so the package
 * ends up carrying a stale, unreferenced bundle alongside the real one.
 * Disabling publicDir keeps the package to exactly what index.html loads.
 */
import base from "./vite.config"
import { mergeConfig } from "vite"

export default mergeConfig(base, { publicDir: false })
