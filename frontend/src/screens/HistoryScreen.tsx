import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { AddWorkoutSheet } from '../components/AddWorkoutSheet'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { doneSetCount, parseISODate, toISODate, workoutTonnage } from '../domain/metrics'
import { formatInteger } from '../domain/number'
import { plural } from '../domain/plural'
import type { Workout } from '../domain/types'
import { formatDuration } from '../domain/workout'
import styles from './HistoryScreen.module.css'

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
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
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

/** Тренировки по месяцам, новые сверху: «2026-09» → [...]. */
function byMonth(workouts: Workout[]): [string, Workout[]][] {
  const groups = new Map<string, Workout[]>()
  for (const w of workouts) {
    const key = w.date.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), w])
  }
  return [...groups.entries()]
}

/** История тренировок (ТЗ 2.4): дата, название, длительность, тоннаж. */
export function HistoryScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const workouts = useLiveQuery(() => repos.workouts.listDone(), [repos])
  const planned = useLiveQuery(() => repos.workouts.listPlanned(), [repos])
  const [adding, setAdding] = useState(false)
  const today = toISODate(new Date())

  return (
    <Screen
      title="История"
      eyebrow={
        workouts?.length
          ? `${workouts.length} ${plural(workouts.length, 'тренировка', 'тренировки', 'тренировок')}`
          : undefined
      }
      action={
        <Button variant="primary" size="sm" icon="plus" onClick={() => setAdding(true)}>
          Добавить
        </Button>
      }
    >
      {planned && planned.length > 0 && (
        <section className={styles.month} aria-label="Запланировано">
          <h2 className={styles.monthTitle}>
            Запланировано <span className={styles.count}>{planned.length}</span>
          </h2>
          <ul className={styles.list}>
            {planned.map((w) => {
              const d = parseISODate(w.date)
              const missed = w.date < today
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => navigate(`/history/${w.id}/edit`)}
                  >
                    <span className={`${styles.date} ${styles.plannedDate}`}>
                      <span className={styles.day}>{d.getDate()}</span>
                      <span className={styles.weekday}>{WEEKDAYS[d.getDay()]}</span>
                    </span>
                    <span className={styles.text}>
                      <span className={styles.name}>{w.name}</span>
                      <span className={styles.meta}>
                        {missed
                          ? 'не выполнена'
                          : w.date === today
                            ? 'сегодня'
                            : `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`}
                        {` · ${w.entries.length} упр.`}
                      </span>
                    </span>
                    <span className={styles.chevron}>
                      <Icon name="chevron" size={18} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {workouts?.length === 0 && (
        <EmptyState title="Тренировок пока нет">
          <p>Здесь появятся завершённые тренировки.</p>
        </EmptyState>
      )}

      {workouts &&
        byMonth(workouts).map(([month, list]) => {
          const [y, m] = month.split('-').map(Number)
          const title = `${MONTHS[m - 1]} ${y}`
          return (
            <section key={month} className={styles.month} aria-label={title}>
              <h2 className={styles.monthTitle}>
                {title} <span className={styles.count}>{list.length}</span>
              </h2>
              <ul className={styles.list}>
                {list.map((w) => {
                  const d = parseISODate(w.date)
                  const sets = doneSetCount(w)
                  const duration =
                    w.finishedAt && !w.manual ? formatDuration(w.finishedAt - w.startedAt) : null
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        className={styles.row}
                        onClick={() => navigate(`/history/${w.id}`)}
                      >
                        <span className={styles.date}>
                          <span className={styles.day}>{d.getDate()}</span>
                          <span className={styles.weekday}>{WEEKDAYS[d.getDay()]}</span>
                        </span>
                        <span className={styles.text}>
                          <span className={styles.name}>{w.name}</span>
                          <span className={styles.meta}>
                            {[duration, `${sets} ${plural(sets, 'подход', 'подхода', 'подходов')}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span className={styles.tonnage}>
                          <span className={styles.tonnageValue}>
                            {formatInteger(workoutTonnage(w))}
                          </span>
                          <span className={styles.meta}>кг</span>
                        </span>
                        <span className={styles.chevron}>
                          <Icon name="chevron" size={18} />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      <AddWorkoutSheet open={adding} onClose={() => setAdding(false)} />
    </Screen>
  )
}
