import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/golos-text/cyrillic-400.css'
import '@fontsource/golos-text/latin-400.css'
import '@fontsource/golos-text/cyrillic-600.css'
import '@fontsource/golos-text/latin-600.css'
import '@fontsource/unbounded/cyrillic-600.css'
import '@fontsource/unbounded/latin-600.css'
import './app/theme.css'
import { App } from './app/App'
import { listenForInstallPrompt } from './app/device'
import { applyTheme, getTheme } from './app/theme'
import { registerSW } from 'virtual:pwa-register'

applyTheme(getTheme())
listenForInstallPrompt()
// Файлы приложения кэшируются для работы без интернета; новая версия ставится сама
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
