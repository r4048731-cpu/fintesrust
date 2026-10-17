import styles from './Tabs.module.css'

interface Props<T extends string> {
  /** Подпись для экранного диктора. */
  label: string
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
}

/**
 * Вкладки внутри раздела: текст с подчёркиванием и счётчиком. Отличаются от `Segmented`
 * на вид, чтобы два уровня переключателей не сливались.
 */
export function Tabs<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
        >
          <span className={styles.name}>{o.label}</span>
          {o.count !== undefined && <span className={styles.count}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
