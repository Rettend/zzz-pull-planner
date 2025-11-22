import { defineConfig } from '@solidjs/start/config'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  ssr: false,
  server: {
    preset: 'cloudflare-module',
    // prerender: {
    //   routes: ['/', '/*404'],
    // }
  },
  vite: {
    plugins: [UnoCSS()],
  },
})
