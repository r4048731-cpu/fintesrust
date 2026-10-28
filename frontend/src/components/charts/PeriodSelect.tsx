import { PERIODS, type Period } from '../../domain/period'
import { Icon } from '../Icon'
import styles from './PeriodSelect.module.css'

/** Выбор периода графика: «Неделя ▾», «Месяц ▾»… Обычный select — на телефоне открывается системный список. */
export function PeriodSelect({
  value,
  onChange,
  label = 'Период',
}: {
  value: Period
  onChange: (p: Period) => void
  label?: string
}) {
  return (
    <label className={styles.period}>
      <Icon name="calendar" size={20} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Period)}>
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <Icon name="down" size={20} />
    </label>
  )
}
