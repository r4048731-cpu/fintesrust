import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { parseISODate, toISODate } from '../domain/metrics'
import { formatKm } from '../domain/run'
import type { ISODate, Workout } from '../domain/types'
import { IconButton } from './Button'
import { Icon } from './Icon'
import styles from './MonthCalendar.module.css'

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]
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
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

/** 42 дня сетки месяца с понедельника: хвосты соседних месяцев — бледные. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const shift = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - shift + i))
}

/**
 * «Прогресс» → «История»: календарь месяца, как в дневниках тренировок.
 * Дни с тренировкой или пробежкой отмечены, по нажатию — что было в этот день.
 */
export function MonthCalendar({ workouts }: { workouts: Workout[] }) {
  const repos = useRepos()
  const navigate = useNavigate()
  const runs = useLiveQuery(() => repos.runs.list(), [repos])
  const now = new Date()
  const today = toISODate(now)
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [picked, setPicked] = useState<ISODate>(today)

  const runDays = new Map<ISODate, NonNullable<typeof runs>>()
  for (const r of runs ?? []) {
    const d = toISODate(new Date(r.startedAt))
    runDays.set(d, [...(runDays.get(d) ?? []), r])
  }
  const workoutDays = new Map<ISODate, Workout[]>()
  for (const w of workouts) workoutDays.set(w.date, [...(workoutDays.get(w.date) ?? []), w])

  const days = monthGrid(cursor.y, cursor.m)
  // последняя неделя целиком из следующего месяца не нужна
  const shown = days[35].getMonth() === cursor.m ? days : days.slice(0, 35)
  const isCurrent = cursor.y === now.getFullYear() && cursor.m === now.getMonth()
  const move = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  const pickedDate = parseISODate(picked)
  const dayWorkouts = workoutDays.get(picked) ?? []
  const dayRuns = runDays.get(picked) ?? []

  return (
    <section className={styles.calendar} aria-label="Календарь тренировок">
      <div className={styles.head}>
        <h2 className={styles.month}>
          {MONTHS[cursor.m]} <span>{cursor.y}</span>
        </h2>
        <div className={styles.nav}>
          <IconButton
            icon="back"
            size="sm"
            variant="secondary"
            label="Предыдущий месяц"
            onClick={() => move(-1)}
          />
          <IconButton
            icon="chevron"
            size="sm"
            variant="secondary"
            label="Следующий месяц"
            disabled={isCurrent}
            onClick={() => move(1)}
          />
        </div>
      </div>

      <div className={styles.grid} role="grid" aria-label={`${MONTHS[cursor.m]} ${cursor.y}`}>
        {WEEK.map((d) => (
          <span key={d} className={styles.weekday} aria-hidden="true">
            {d}
          </span>
        ))}
        {shown.map((d) => {
          const iso = toISODate(d)
          const done = workoutDays.has(iso)
          const ran = runDays.has(iso)
          const outside = d.getMonth() !== cursor.m
          const future = iso > today
          return (
            <button
              key={iso}
              type="button"
              className={styles.day}
              data-outside={outside || undefined}
              data-today={iso === today || undefined}
              data-done={done || undefined}
              aria-pressed={iso === picked}
              disabled={future}
              aria-label={`${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${done ? ', тренировка' : ''}${ran ? ', пробежка' : ''}`}
              onClick={() => setPicked(iso)}
            >
              {d.getDate()}
              {(done || ran) && (
                <span className={styles.marks} aria-hidden="true">
                  {done && <i data-kind="workout" />}
                  {ran && <i data-kind="run" />}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className={styles.picked}>
        <h3 className={styles.pickedTitle}>
          {pickedDate.getDate()} {MONTHS_GEN[pickedDate.getMonth()]},{' '}
          {WEEKDAYS[pickedDate.getDay()]}
        </h3>
        {dayWorkouts.length + dayRuns.length === 0 ? (
          <p className={styles.none}>В этот день тренировок не было</p>
        ) : (
          <ul className={styles.list}>
            {dayWorkouts.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => navigate(`/history/${w.id}`)}
                >
                  <Icon name="dumbbell" size={20} />
                  <span>{w.name}</span>
                  <Icon name="chevron" size={20} />
                </button>
              </li>
            ))}
            {dayRuns.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => navigate(`/run/${r.id}`)}
                >
                  <Icon name="run" size={20} />
                  <span>
                    {r.kind === 'run' ? 'Бег' : 'Ходьба'} · {formatKm(r.distanceM)} км
                  </span>
                  <Icon name="chevron" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
