import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: { charts: ["recharts"], realtime: ["laravel-echo", "pusher-js"] } } } },
  server: {
    watch: {usePolling:true,interval:800},
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:8000",
      },
      "/broadcasting": {
        target: process.env.API_PROXY_TARGET || "http://localhost:8000",
      },
      "/storage": {
        target: process.env.API_PROXY_TARGET || "http://localhost:8000",
      },
    },
  },
});
