// Белая или чёрная тема. Хранится в браузере устройства: это настройка вида, а не данные тренировок.

export type Theme = 'light' | 'dark'

const KEY = 'fitnes.theme'
const THEME_COLOR: Record<Theme, string> = { light: '#f7f6fb', dark: '#09080d' }

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Тема, выбранная кнопкой, или настройка телефона, если кнопку ещё не нажимали. */
export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // хранилище недоступно (приватный режим) — берём настройку телефона
  }
  return systemTheme()
}

/** Применяет тему. `remember` — запомнить выбор (после нажатия кнопки). */
export function applyTheme(theme: Theme, remember = false): void {
  document.documentElement.dataset.theme = theme
  if (remember) {
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // не сохранится между запусками, но применится сейчас
    }
  }
  // Цвет строки состояния телефона
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = THEME_COLOR[theme]
  document.head.append(meta)
}
