// Белая или чёрная тема и «чистый чёрный» для AMOLED. Хранятся в браузере устройства:
// это настройка вида, а не данные тренировок.

export type Theme = 'light' | 'dark'
/** Выбор в настройках: своя тема или как в телефоне. */
export type ThemeChoice = Theme | 'system'

const KEY = 'fitnes.theme'
const AMOLED_KEY = 'fitnes.amoled'
const EVENT = 'fitnes:theme'
const THEME_COLOR = { light: '#f7f6fb', dark: '#09080d', black: '#000000' }

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // хранилище недоступно (приватный режим) — живём без запомненного выбора
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // не сохранится между запусками, но применится сейчас
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getThemeChoice(): ThemeChoice {
  const v = read(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

/** Тема, выбранная кнопкой или в настройках, или настройка телефона. */
export function getTheme(): Theme {
  const choice = getThemeChoice()
  return choice === 'system' ? systemTheme() : choice
}

/** Чистый чёрный фон в тёмной теме — экономит батарею на AMOLED-экранах. */
export function getAmoled(): boolean {
  return read(AMOLED_KEY) === '1'
}

/** Применяет тему. `remember` — запомнить выбор (после нажатия кнопки). */
export function applyTheme(theme: Theme, remember = false): void {
  const root = document.documentElement
  root.dataset.theme = theme
  const amoled = getAmoled()
  if (amoled) root.dataset.amoled = ''
  else delete root.dataset.amoled
  if (remember) write(KEY, theme)
  // Цвет строки состояния телефона
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = theme === 'dark' && amoled ? THEME_COLOR.black : THEME_COLOR[theme]
  document.head.append(meta)
}

function changed(): void {
  applyTheme(getTheme())
  window.dispatchEvent(new Event(EVENT))
}

export function setThemeChoice(choice: ThemeChoice): void {
  write(KEY, choice === 'system' ? null : choice)
  changed()
}

export function setAmoled(on: boolean): void {
  write(AMOLED_KEY, on ? '1' : null)
  changed()
}

/** Подписка на смену темы — чтобы кнопка в шапке и настройки показывали одно и то же. */
export function onThemeChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
