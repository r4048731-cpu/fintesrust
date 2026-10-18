import { useEffect, useState } from 'react'
import { getTheme, onThemeChange, setThemeChoice, type Theme } from '../app/theme'
import { IconButton } from './Button'

/** Кнопка в верхней панели: переключает белую и чёрную тему и запоминает выбор. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getTheme)
  useEffect(() => onThemeChange(() => setTheme(getTheme())), [])
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <IconButton
      icon={theme === 'dark' ? 'sun' : 'moon'}
      label={next === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему'}
      variant="secondary"
      onClick={() => setThemeChoice(next)}
    />
  )
}
