import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "@specora/core",
      "@specora/import-postman",
      "postman-collection-transformer"
    ]
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  ssr: {
    noExternal: ["@specora/core", "@specora/import-postman"]
  },
  build: {
    outDir: mode === "embed" ? "dist-embed" : "dist",
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  server: {
    port: 5173
  }
}));
