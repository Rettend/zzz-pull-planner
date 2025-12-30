import { defineConfig } from '@solidjs/start/config'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  ssr: true,
  middleware: 'src/middleware.ts',
  server: {
    preset: 'cloudflare-module',
    prerender: {
      routes: [
        '/404', // does not work idk how to do it
        '/about',
        '/guide',
        '/sitemap.xml',
      ],
    },
  },
  vite: {
    plugins: [UnoCSS()],
  },
})
