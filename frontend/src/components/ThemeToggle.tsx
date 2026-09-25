import { useState } from 'react'
import { applyTheme, getTheme, type Theme } from '../app/theme'
import { IconButton } from './Button'

/** Кнопка в верхней панели: переключает белую и чёрную тему и запоминает выбор. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getTheme)
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <IconButton
      icon={theme === 'dark' ? 'sun' : 'moon'}
      label={next === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему'}
      variant="secondary"
      onClick={() => {
        applyTheme(next, true)
        setTheme(next)
      }}
    />
  )
}
