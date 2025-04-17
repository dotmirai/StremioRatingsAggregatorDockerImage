// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/configure/',
  build: {
    outDir: '../frontend/dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    manifest: true
  }
})