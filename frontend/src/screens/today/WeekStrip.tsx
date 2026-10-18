import { formatDecimal } from '../../domain/number'
import { plural } from '../../domain/plural'
import type { WeekStreak } from '../../domain/metrics'
import { Icon } from '../../components/Icon'
import frame from '../../components/frame.module.css'
import type { WeekDay } from './useToday'
import { CountUp } from '../../components/fx/CountUp'
import styles from './WeekStrip.module.css'

interface Props {
  days: WeekDay[]
  count: number
  tonnageKg: number
  streak: WeekStreak
  /** Нажатие на день — показать его тренировки. */
  onPickDay: (day: WeekDay) => void
  /** Нажатие на итог недели — открыть прогресс. */
  onSummary: () => void
}

/** Неделя пн–вс: дни с тренировкой залиты, запланированные обведены пунктиром, сегодня обведено. */
export function WeekStrip({ days, count, tonnageKg, streak, onPickDay, onSummary }: Props) {
  return (
    <section
      className={streak.met ? `${styles.week} ${styles.met} ${frame.frame}` : styles.week}
      aria-label="Эта неделя"
    >
      <div className={styles.streakRow}>
        <span className={`${styles.streak} ${streak.weeks ? styles.hot : ''}`}>
          <Icon name="flame" size={16} />
          {streak.weeks
            ? `${streak.weeks} ${plural(streak.weeks, 'неделя', 'недели', 'недель')} подряд`
            : 'Начните серию'}
        </span>
        <span
          className={styles.goal}
          aria-label={`Цель недели: ${Math.min(streak.thisWeek, streak.goal)} из ${streak.goal}`}
        >
          {streak.met ? 'цель ✓' : `цель ${streak.thisWeek} из ${streak.goal}`}
          <span className={styles.goalDots} aria-hidden="true">
            {Array.from({ length: streak.goal }, (_, i) => (
              <span key={i} className={i < streak.thisWeek ? styles.goalDone : undefined} />
            ))}
          </span>
        </span>
      </div>
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
        {count ? (
          <>
            <b>
              <CountUp value={count} format={(v) => String(Math.round(v))} />
            </b>{' '}
            {plural(count, 'тренировка', 'тренировки', 'тренировок')} ·{' '}
            <b>
              <CountUp
                value={tonnageKg}
                format={(v) => `${formatDecimal(Math.round(v / 100) / 10)} т`}
              />
            </b>{' '}
            за неделю
          </>
        ) : (
          'На этой неделе тренировок ещё не было'
        )}
      </button>
    </section>
  )
}
