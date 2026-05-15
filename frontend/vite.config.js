import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode
  const env = loadEnv(mode, process.cwd(), '');

  const basePath = env.VITE_BASE_PATH
    ? `/${env.VITE_BASE_PATH.replace(/^\/|\/$/g, '')}/`
    : (mode === 'production' ? '/dashboard/' : '/');

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5176,
      strictPort: true,
      proxy: {
        "/api": {
          // In dev, proxy /api to the backend.
          // VITE_API_BACKEND must be set in .env for this to work correctly.
          // Falls back to localhost:5177 (the backend port from backend/.env PORT=5177)
          target: env.VITE_API_BACKEND || "http://localhost:5177",
          changeOrigin: true,
          secure: false
        },
      },
    },
    // Use absolute base path so assets load correctly on any route (fixes blank page on refresh)
    base: basePath,
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
    },
  };
});