import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// base './' so the build runs from any static host path (GitHub Pages, Vercel, Netlify).
// index.html = marketing site, app.html = the product.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: { index: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app.html') },
    },
  },
})
