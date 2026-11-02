import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../../app/dataContext'
import { toISODate } from '../../domain/metrics'
import { formatInteger } from '../../domain/number'
import { sumNutrients } from '../../domain/nutrition'
import { formatSleep, SLEEP_GOAL_MIN, waterGoalMl } from '../../domain/trackers'
import { DEFAULT_STEPS_GOAL, isAndroidApp, Steps } from '../../native/steps'
import goalFx from '../fx/goal.module.css'
import { Icon, type IconName } from '../Icon'
import styles from './DayTiles.module.css'

type Tone = 'food' | 'water' | 'sleep' | 'steps'

interface Tile {
  tone: Tone
  icon: IconName
  label: string
  value: ReactNode
  /** Доля от цели, 0…1; null — цели нет, кольцо пустое. */
  share: number | null
  /** Подпись для диктора: «Калории: 1 450 из 2 200». */
  aria: string
  to: string
}

/**
 * «Сегодня» → сводка дня плитками 2×2: калории, вода, сон и шаги с мини-кольцами.
 * Нажатие ведёт туда, где это записывают; шаги — из базы, куда их переносит StepsSync.
 */
export function DayTiles() {
  const repos = useRepos()
  const navigate = useNavigate()
  const today = toISODate(new Date())
  const stepsGoal = useStepsGoal()
  const data = useLiveQuery(async () => {
    const [meals, plan, trackers, weights, steps] = await Promise.all([
      repos.meals.listDay(today),
      repos.meta.get('nutritionPlan'),
      repos.meta.get('dayTrackers'),
      repos.bodyWeights.list(),
      repos.meta.get('stepsHistory'),
    ])
    return {
      kcal: sumNutrients(meals).calories,
      plan: plan?.calories ?? null,
      water: trackers[today]?.waterMl ?? 0,
      waterGoal: waterGoalMl(weights.at(-1)?.weightKg ?? null),
      sleep: trackers[today]?.sleepMin ?? 0,
      steps: steps[today] ?? null,
    }
  }, [repos, today])
  if (!data) return null

  const liters = (ml: number) => (ml / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  const tiles: Tile[] = [
    {
      tone: 'food',
      icon: 'flame',
      label: 'Калории',
      value: (
        <>
          {formatInteger(Math.round(data.kcal))}
          {data.plan && <span> / {formatInteger(data.plan)}</span>}
        </>
      ),
      share: data.plan ? data.kcal / data.plan : null,
      aria: `Калории: ${Math.round(data.kcal)}${data.plan ? ` из ${data.plan}` : ''}`,
      to: '/food',
    },
    {
      tone: 'water',
      icon: 'water',
      label: 'Вода',
      value: (
        <>
          {liters(data.water)}
          <span> / {liters(data.waterGoal)} л</span>
        </>
      ),
      share: data.water / data.waterGoal,
      aria: `Вода: ${liters(data.water)} из ${liters(data.waterGoal)} л`,
      to: '/food',
    },
    {
      tone: 'sleep',
      icon: 'sleep',
      label: 'Сон',
      value: data.sleep ? formatSleep(data.sleep) : '—',
      share: data.sleep / SLEEP_GOAL_MIN,
      aria: `Сон: ${data.sleep ? formatSleep(data.sleep) : 'не записан'}`,
      to: '/food',
    },
    {
      tone: 'steps',
      icon: 'run',
      label: 'Шаги',
      value:
        data.steps === null ? (
          <span>{isAndroidApp() ? 'нет данных' : 'в Android'}</span>
        ) : (
          formatInteger(data.steps)
        ),
      share: data.steps === null ? null : data.steps / stepsGoal,
      aria: `Шаги: ${data.steps === null ? 'нет данных' : `${data.steps} из ${stepsGoal}`}`,
      to: '/progress?view=charts',
    },
  ]

  return (
    <section className={styles.grid} aria-label="Сводка дня">
      {tiles.map((t) => {
        const pct = t.share === null ? 0 : Math.min(100, Math.round(t.share * 100))
        return (
          <button
            key={t.tone}
            type="button"
            className={styles.tile}
            aria-label={t.aria}
            onClick={() => navigate(t.to)}
          >
            <span
              className={pct >= 100 ? `${styles.ring} ${goalFx.glow}` : styles.ring}
              data-tone={t.tone}
              aria-hidden="true"
            >
              <svg viewBox="0 0 46 46">
                <circle cx="23" cy="23" r="19" className={styles.track} />
                {pct > 0 && (
                  <circle
                    cx="23"
                    cy="23"
                    r="19"
                    pathLength={100}
                    className={styles.arc}
                    style={{ strokeDasharray: `${pct} 100` }}
                  />
                )}
              </svg>
              <Icon name={pct >= 100 ? 'check' : t.icon} size={18} />
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{t.label}</span>
              <b className={styles.value}>{t.value}</b>
            </span>
          </button>
        )
      })}
    </section>
  )
}

/** Цель шагов с телефона; в браузере — по умолчанию. */
function useStepsGoal(): number {
  const [goal, setGoal] = useState(DEFAULT_STEPS_GOAL)
  useEffect(() => {
    if (!isAndroidApp()) return
    void Steps.status()
      .then((s) => s.goal && setGoal(s.goal))
      .catch(() => {})
  }, [])
  return goal
}
