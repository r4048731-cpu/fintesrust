import { useId, useState } from 'react'
import { formatDecimal, parseDecimal, stepValue, clamp } from '../domain/number'
import styles from './Stepper.module.css'

interface Props {
  value: number
  onChange: (value: number) => void
  /** Шаг кнопок ±, например шаг веса 2,5 кг. */
  step: number
  min?: number
  max?: number
  /** Подпись для экранного диктора, например «Вес, кг». */
  label: string
  /** Разрешить дробные значения (вес) или только целые (повторения). */
  decimal?: boolean
  id?: string
  /** Узкий вариант для строк подходов, где в ряд стоят два счётчика. */
  compact?: boolean
}

/**
 * Счётчик «− число +» для веса и повторений. Число можно ввести с клавиатуры:
 * пока поле в фокусе, хранится черновик текста, значение применяется при уходе с поля или Enter.
 */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max = 9999,
  label,
  decimal = false,
  id,
  compact = false,
}: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft === null) return
    const parsed = parseDecimal(draft)
    setDraft(null)
    if (parsed === null) return
    const next = clamp(decimal ? parsed : Math.round(parsed), min, max)
    if (next !== value) onChange(next)
  }

  return (
    <div className={compact ? `${styles.stepper} ${styles.compact}` : styles.stepper}>
      <button
        type="button"
        className={styles.btn}
        aria-label={`${label}: уменьшить на ${formatDecimal(step)}`}
        onClick={() => onChange(stepValue(value, -1, step, min, max))}
        disabled={value <= min}
      >
        −
      </button>
      <input
        id={inputId}
        className={styles.input}
        aria-label={label}
        inputMode={decimal ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={draft ?? formatDecimal(value)}
        onFocus={(e) => {
          setDraft(formatDecimal(value))
          e.currentTarget.select()
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <button
        type="button"
        className={styles.btn}
        aria-label={`${label}: увеличить на ${formatDecimal(step)}`}
        onClick={() => onChange(stepValue(value, 1, step, min, max))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  )
}
