import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  optimizeDeps: {
    include: ["@specora/core", "@radix-ui/react-dropdown-menu"]
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  ssr: {
    noExternal: ["@specora/core"]
  },
  build: {
    outDir: mode === "embed" ? "dist-embed" : "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Stable vendor chunks cache across app deploys.
        manualChunks(id) {
          const match = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
          if (!match) return undefined;
          const pkg = match[1]!;
          if (["react", "react-dom", "scheduler"].includes(pkg)) return "react";
          if (pkg === "yaml") return "yaml";
          return "vendor";
        }
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  server: {
    port: 5173
  }
}));
