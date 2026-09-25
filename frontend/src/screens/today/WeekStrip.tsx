import { formatDecimal } from '../../domain/number'
import { plural } from '../../domain/plural'
import type { WeekDay } from './useToday'
import styles from './WeekStrip.module.css'

interface Props {
  days: WeekDay[]
  count: number
  tonnageKg: number
}

/** Неделя пн–вс: дни с тренировкой залиты, сегодня обведено. */
export function WeekStrip({ days, count, tonnageKg }: Props) {
  return (
    <section className={styles.week} aria-label="Эта неделя">
      <ol className={styles.days}>
        {days.map((d) => (
          <li
            key={d.date}
            className={[styles.day, d.done && styles.done, d.today && styles.today]
              .filter(Boolean)
              .join(' ')}
            aria-label={`${d.label}${d.done ? ', была тренировка' : ''}${d.today ? ', сегодня' : ''}`}
          >
            <span className={styles.dot}>{Number(d.date.slice(8))}</span>
            <span className={styles.label}>{d.label}</span>
          </li>
        ))}
      </ol>
      <p className={styles.summary}>
        {count
          ? `${count} ${plural(count, 'тренировка', 'тренировки', 'тренировок')} · ${formatDecimal(Math.round(tonnageKg / 100) / 10)} т за неделю`
          : 'На этой неделе тренировок ещё не было'}
      </p>
    </section>
  )
}
