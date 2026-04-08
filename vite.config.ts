import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'JAN Sync',
        short_name: 'JANSync',
        description: 'JANコードスキャン＆生成アプリ',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    host: true,
  },
})
