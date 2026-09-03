import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '静日 · Quiet Daybook',
        short_name: '静日',
        description: '日历、任务、想法与开销的个人工作台',
        theme_color: '#f5f1e8',
        background_color: '#f5f1e8',
        display: 'standalone',
        lang: 'zh-CN',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      }
    })
  ]
})
