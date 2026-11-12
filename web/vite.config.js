import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const raizProjeto = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const ambiente = loadEnv(mode, raizProjeto, "");
  const apiTarget = ambiente.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": raizProjeto,
      },
      extensions: [".jsx", ".js", ".json"],
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api/v1": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/admin/": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/media": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/static": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
