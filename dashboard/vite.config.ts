import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ready': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/dexscreener': {
        target: 'https://api.dexscreener.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dexscreener/, ''),
      },
      '/rugcheck': {
        target: 'https://api.rugcheck.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rugcheck/, ''),
      },
      '/goplus': {
        target: 'https://api.gopluslabs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/goplus/, ''),
      },
    },
  },
})
