import { useEffect, useMemo, useRef, useState } from 'react'
import { activityGrid, parseISODate, toISODate, type ActivityDay } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import { plural } from '../domain/plural'
import type { Workout } from '../domain/types'
import { Card } from './Screen'
import styles from './ActivityHeatmap.module.css'

/** Год — 53 недели, чтобы влез и прошлогодний месяц на краю. */
const WEEKS = 53
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function describe(day: ActivityDay): string {
  const d = parseISODate(day.date)
  const date = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`
  if (!day.workouts) return `${date} — без тренировки`
  const count = `${day.workouts} ${plural(day.workouts, 'тренировка', 'тренировки', 'тренировок')}`
  const tonnage =
    day.tonnageKg > 0 ? ` · ${formatDecimal(Math.round(day.tonnageKg / 100) / 10)} т` : ''
  return `${date} — ${count}${tonnage}`
}

/**
 * Тепловая карта за год, как у GitHub: столбец — неделя, клетка — день, чем ярче — тем
 * больше тоннаж. Прокручивается вбок, открывается на текущей неделе; нажатие на день — подпись.
 */
export function ActivityHeatmap({ workouts }: { workouts: Workout[] }) {
  const [now] = useState(() => new Date())
  const grid = useMemo(() => activityGrid(workouts, WEEKS, now), [workouts, now])
  const [picked, setPicked] = useState<ActivityDay | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const today = toISODate(now)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const past = grid.flat().filter((d) => !d.future)
  const total = past.reduce((s, d) => s + d.workouts, 0)
  const activeDays = past.filter((d) => d.workouts > 0).length
  const byDate = new Map(past.map((d) => [d.date, d]))

  return (
    <Card framed>
      <div className={styles.head}>
        <h2 className={styles.title}>Год тренировок</h2>
        <span className={styles.sub}>
          {total} {plural(total, 'тренировка', 'тренировки', 'тренировок')} · {activeDays}{' '}
          {plural(activeDays, 'день', 'дня', 'дней')}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.weekdays} aria-hidden="true">
          <span>пн</span>
          <span />
          <span>ср</span>
          <span />
          <span>пт</span>
          <span />
          <span />
        </div>
        <div className={styles.scroller} ref={scroller}>
          <div className={styles.months} aria-hidden="true">
            {grid.map((col, c) => {
              const m = parseISODate(col[0].date).getMonth()
              const prev = c > 0 ? parseISODate(grid[c - 1][0].date).getMonth() : -1
              return <span key={c}>{m !== prev && c > 0 ? MONTHS[m] : ''}</span>
            })}
          </div>
          {/* Клетки — украшение с подписью по нажатию; итог года прочитается из заголовка */}
          <div
            className={styles.grid}
            aria-label={`Тренировки за год: ${total} за ${activeDays} ${plural(activeDays, 'день', 'дня', 'дней')}`}
            onClick={(e) => {
              const date = (e.target as HTMLElement).dataset.date
              const day = date ? byDate.get(date) : undefined
              if (day) setPicked(day)
            }}
          >
            {grid.map((col, c) => (
              <div key={c} className={styles.column} style={{ '--c': c } as React.CSSProperties}>
                {col.map((d) => (
                  <span
                    key={d.date}
                    data-date={d.future ? undefined : d.date}
                    data-level={d.future ? undefined : d.level}
                    className={[
                      styles.cell,
                      d.future && styles.future,
                      d.date === today && styles.today,
                      picked?.date === d.date && styles.picked,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.foot}>
        <span className={styles.info} role="status">
          {picked ? describe(picked) : 'Нажмите на день, чтобы увидеть подробности'}
        </span>
        <span className={styles.legend} aria-hidden="true">
          меньше
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={styles.cell} data-level={l} />
          ))}
          больше
        </span>
      </div>
    </Card>
  )
}
