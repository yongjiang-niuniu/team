import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 加上这一行

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), 
  ],
  server: {
    allowedHosts: process.env.VITE_ALLOWED_HOSTS === 'all' ? true : undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:5050',
        changeOrigin: true,
      },
    },
  },
})
