/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative paths so the build works from any sub-path (e.g. a project page) without changes.
  base: './',
  plugins: [
    react(),
    // Precaches the whole build (code + curriculum JSON) so both update together; no runtime caching,
    // so Gemini responses are never cached (spec §3).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'hablemos',
        short_name: 'hablemos',
        description: '한국어 화자를 위한 스페인어 입문 학습',
        lang: 'ko',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f4efe6',
        theme_color: '#1f5e5b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
