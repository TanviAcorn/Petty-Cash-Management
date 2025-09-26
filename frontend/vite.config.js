import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5176,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.VITE_API_BACKEND || "http://172.30.36.47:5005",
          changeOrigin: true,
          secure: false
        },
      },
    },
    // For production build
    base: './', // This makes the build work when deployed to subdirectories
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
    },
  };
});