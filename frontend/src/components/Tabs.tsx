import { useLayoutEffect, useRef, useState } from 'react'
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
 * на вид, чтобы два уровня переключателей не сливались. Подчёркивание переезжает к выбранной.
 */
export function Tabs<T extends string>({ label, options, value, onChange }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null)
  const [line, setLine] = useState<{ left: number; width: number } | null>(null)

  // ширина вкладок — по названию, поэтому положение подчёркивания меряется
  useLayoutEffect(() => {
    const measure = () => {
      const tab = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')
      setLine(tab && tab.offsetWidth ? { left: tab.offsetLeft, width: tab.offsetWidth } : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [value, options.length])

  return (
    <div ref={ref} className={styles.tabs} role="tablist" aria-label={label}>
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
      {line && (
        <span
          className={styles.line}
          aria-hidden="true"
          style={{ width: line.width, translate: `${line.left}px 0` }}
        />
      )}
    </div>
  )
}
