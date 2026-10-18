import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Android-версия: то же веб-приложение внутри нативной оболочки Capacitor.
 * Даёт то, чего нет у браузера: шаги за день из Health Connect и уведомление с итогом.
 */
const config: CapacitorConfig = {
  appId: 'ru.fitnes.app',
  appName: 'Фитнес',
  webDir: 'dist',
  android: {
    // приложение открывается со своего адреса https://localhost — это «защищённый» контекст,
    // поэтому GPS и остальные API работают так же, как на GitHub Pages
    allowMixedContent: false,
  },
}

export default config
