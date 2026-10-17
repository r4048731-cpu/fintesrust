/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Установка на главный экран и работа без интернета: service worker кэширует все файлы
    // приложения, данные и так лежат на телефоне. Новая версия подхватывается сама.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Фитнес',
        short_name: 'Фитнес',
        description: 'Программы тренировок, подходы, веса и прогресс',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#09080d',
        theme_color: '#7c3aed',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Кадры техники (webp, ~2,5 МБ) тоже кэшируются: в зале они нужны и без интернета
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  // Относительные пути: сборка работает и в корне домена, и в подпапке GitHub Pages
  base: './',
  build: {
    // Всё приложение — один файл ~630 КБ (~190 КБ в сжатом виде), после первого открытия
    // он лежит в кэше телефона. Делить на части ради скорости первой загрузки незачем.
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // Тесты интерфейса имитируют касания по одному; на нагруженной машине 5 с по умолчанию не хватает
    testTimeout: 15_000,
  },
})
