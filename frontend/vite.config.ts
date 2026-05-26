import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/**
 * Injects a fresh ?v=<build-time> on /static/style.css in the generated
 * SPA index.html on every build. Without this, the cache-buster string
 * sits stale forever and every CSS edit after a deploy is invisible
 * until users do a hard refresh. We discovered the toast styles never
 * rendered because the busted query string had been frozen since April.
 */
function cacheBustStyleCss() {
  return {
    name: 'cache-bust-style-css',
    transformIndexHtml(html: string) {
      const v = Date.now().toString(36)
      return html.replace(
        /\/static\/style\.css\?v=[^"']+/g,
        `/static/style.css?v=${v}`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cacheBustStyleCss()],
  base: '/static/spa/',
  build: {
    outDir: path.resolve(__dirname, '../static/spa'),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/auth': 'http://127.0.0.1:8000',
      '/leagues': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
    },
  },
})
