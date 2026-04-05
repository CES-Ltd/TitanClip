import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const isElectronBuild = process.env.ELECTRON_BUILD === "true";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        lexical: path.resolve(__dirname, "./node_modules/lexical/Lexical.mjs"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:3100",
          ws: true,
        },
      },
    },
    build: {
      // For Electron production builds, use relative paths so assets
      // resolve correctly from the app:// custom protocol or file://
      ...(isElectronBuild
        ? {
            // Relative asset paths (not absolute /assets/...)
            base: "./",
            // Output to ui/dist as usual
            outDir: "dist",
            // Generate source maps for debugging production issues
            sourcemap: true,
            // Optimize chunk size for local loading (no network latency)
            rollupOptions: {
              output: {
                // Fewer, larger chunks — no need to optimize for HTTP/2 parallel loading
                manualChunks: undefined,
              },
            },
          }
        : {}),
    },
    // Define environment variables available to the renderer
    define: {
      __ELECTRON__: JSON.stringify(isElectronBuild),
    },
  };
});
