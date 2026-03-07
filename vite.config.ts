import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

const embedBase = process.env.EMBED_BASE_PATH || "./"

const backendPort = Number(process.env.PORT) || 3001

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: embedBase,
  server: {
    port: 3000,
    proxy: {
      // Tải file Archive qua proxy (tránh CORS): /api/quantis/archive-file/* → 101.96.66.222:8013/*
      // Presigned URL ký với Host: files-archive.neu.edu.vn → proxy gửi đúng Host để tránh 403
      "/api/quantis/archive-file": {
        target: "http://101.96.66.222:8013",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/quantis\/archive-file/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Host", "files-archive.neu.edu.vn");
          });
        },
      },
      // Archive NEU: localhost:3000/api/quantis/archive/* → 101.96.66.222:8010/api/v1/*
      "/api/quantis/archive": {
        target: "http://101.96.66.222:8010",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/quantis\/archive/, "/api/v1"),
      },
      "/api/quantis": { target: `http://localhost:${backendPort}`, changeOrigin: true },
    },
  },
  build: {
    outDir: "public",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
})
