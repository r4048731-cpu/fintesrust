import { formatDecimal } from '../../domain/number'
import { plural } from '../../domain/plural'
import type { WeekDay } from './useToday'
import styles from './WeekStrip.module.css'

interface Props {
  days: WeekDay[]
  count: number
  tonnageKg: number
  /** Нажатие на день — показать его тренировки. */
  onPickDay: (day: WeekDay) => void
  /** Нажатие на итог недели — открыть прогресс. */
  onSummary: () => void
}

/** Неделя пн–вс: дни с тренировкой залиты, запланированные обведены пунктиром, сегодня обведено. */
export function WeekStrip({ days, count, tonnageKg, onPickDay, onSummary }: Props) {
  return (
    <section className={styles.week} aria-label="Эта неделя">
      <ol className={styles.days}>
        {days.map((d) => (
          <li key={d.date}>
            <button
              type="button"
              className={[
                styles.day,
                d.done && styles.done,
                !d.done && d.planned.length > 0 && styles.planned,
                d.today && styles.today,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onPickDay(d)}
              aria-label={`${d.label}${d.done ? ', была тренировка' : ''}${d.planned.length ? ', запланирована тренировка' : ''}${d.today ? ', сегодня' : ''}`}
            >
              <span className={styles.dot}>{Number(d.date.slice(8))}</span>
              <span className={styles.label}>{d.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className={styles.summary}
        onClick={onSummary}
        aria-label="Эта неделя — открыть прогресс"
      >
        {count
          ? `${count} ${plural(count, 'тренировка', 'тренировки', 'тренировок')} · ${formatDecimal(Math.round(tonnageKg / 100) / 10)} т за неделю`
          : 'На этой неделе тренировок ещё не было'}
      </button>
    </section>
  )
}
