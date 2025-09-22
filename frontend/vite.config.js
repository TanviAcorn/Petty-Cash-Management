import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5176,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://172.30.36.47:5005", // Change from localhost to your IP
        changeOrigin: true,
        secure: false,
      },
    },
  },
})