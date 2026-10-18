import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { toISODate } from '../domain/metrics'
import { sumNutrients } from '../domain/nutrition'
import { caloriesRing, stepsRing, trainingRing, type Ring } from '../domain/rings'
import { DEFAULT_STEPS_GOAL, isAndroidApp, Steps } from '../native/steps'
import frame from './frame.module.css'
import styles from './DayRings.module.css'

interface Props {
  /** Идущая тренировка: отмечено и всего подходов. */
  active: { done: number; total: number } | null
  /** Сколько тренировок уже завершено сегодня. */
  doneToday: number
}

interface Row {
  key: 'train' | 'food' | 'steps'
  label: string
  ring: Ring
  to?: string
}

/** Радиусы колец снаружи внутрь, толщина — 10 из 120 единиц рисунка. */
const RADII = [52, 39, 26]

/**
 * Кольца дня на «Сегодня», как в Apple Watch: тренировка, калории и шаги
 * (шаги — только в Android-версии). Нажатие на строку ведёт в нужный раздел.
 */
export function DayRings({ active, doneToday }: Props) {
  const repos = useRepos()
  const navigate = useNavigate()
  const id = useId()
  const today = toISODate(new Date())
  const meals = useLiveQuery(() => repos.meals.listDay(today), [repos, today])
  const plan = useLiveQuery(() => repos.meta.get('nutritionPlan'), [repos])
  const steps = useTodaySteps()
  if (!meals || plan === undefined) return null

  const rows: Row[] = [
    {
      key: 'train',
      label: 'Тренировка',
      ring: trainingRing(active, doneToday),
      to: active ? '/workout' : undefined,
    },
    {
      key: 'food',
      label: 'Калории',
      ring: caloriesRing(sumNutrients(meals).calories, plan?.calories ?? null),
      to: '/food',
    },
    ...(steps
      ? [{ key: 'steps' as const, label: 'Шаги', ring: stepsRing(steps.steps, steps.goal) }]
      : []),
  ]

  return (
    <section className={`${styles.card} ${frame.frame}`} aria-label="Кольца дня">
      <svg className={styles.rings} viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}train`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3563e9" />
            <stop offset="0.5" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#db2777" />
          </linearGradient>
          <linearGradient id={`${id}food`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbbf24" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id={`${id}steps`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#34d399" />
            <stop offset="1" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        {rows.map((r, i) => (
          <g key={r.key} className={styles[r.key]}>
            <circle cx="60" cy="60" r={RADII[i]} className={styles.track} />
            {r.ring.share > 0 && (
              <circle
                cx="60"
                cy="60"
                r={RADII[i]}
                pathLength={100}
                className={styles.arc}
                stroke={`url(#${id}${r.key})`}
                style={{
                  strokeDasharray: `${r.ring.share * 100} 100`,
                  animationDelay: `${i * 120}ms`,
                }}
              />
            )}
          </g>
        ))}
      </svg>

      <ul className={styles.list}>
        {rows.map((r) => {
          const body = (
            <>
              <span className={`${styles.dot} ${styles[r.key]}`} aria-hidden="true" />
              <span className={styles.text}>
                <span className={styles.label}>
                  {r.label}
                  {r.ring.done && <span className={styles.check}> ✓</span>}
                </span>
                <b className={styles.value}>{r.ring.value}</b>
              </span>
              <span className={styles.pct}>{Math.round(r.ring.share * 100)}%</span>
            </>
          )
          return (
            <li key={r.key}>
              {r.to ? (
                <button type="button" className={styles.row} onClick={() => navigate(r.to!)}>
                  {body}
                </button>
              ) : (
                <div className={styles.row}>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Шаги за сегодня из Health Connect; null — веб-версия или доступа нет. */
function useTodaySteps(): { steps: number; goal: number } | null {
  const [value, setValue] = useState<{ steps: number; goal: number } | null>(null)
  useEffect(() => {
    if (!isAndroidApp()) return
    const load = async () => {
      try {
        const st = await Steps.status()
        if (st.health !== 'available' || !st.steps) return setValue(null)
        const { days } = await Steps.daily({ days: 1 })
        setValue({ steps: days.at(-1)?.steps ?? 0, goal: st.goal ?? DEFAULT_STEPS_GOAL })
      } catch {
        setValue(null)
      }
    }
    void load()
    const onShow = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])
  return value
}
