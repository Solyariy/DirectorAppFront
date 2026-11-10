import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server: proxy /api to the local Django server, same as nginx does in Docker.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: loadEnv(mode, '.', 'DEV_').DEV_API_UPSTREAM || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}));
