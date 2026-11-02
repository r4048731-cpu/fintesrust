import type { CSSProperties } from 'react'
import styles from './Segmented.module.css'

interface Props<T extends string> {
  /** Подпись группы для экранного диктора. */
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/**
 * Переключатель из 2–4 вариантов в одну строку. Под выбранным — залитая плашка,
 * при смене она переезжает к новому варианту, а не перескакивает.
 */
export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  const index = options.findIndex((o) => o.value === value)
  return (
    <div
      className={styles.group}
      role="group"
      aria-label={label}
      style={{ '--n': options.length, '--i': Math.max(0, index) } as CSSProperties}
    >
      {index >= 0 && <span className={styles.pill} aria-hidden="true" />}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.option}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
