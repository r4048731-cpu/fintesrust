import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useRepos } from '../../app/dataContext'
import { DEFAULT_STEPS_GOAL, isAndroidApp, Steps } from '../../native/steps'
import { toISODate } from '../../domain/metrics'
import { formatInteger } from '../../domain/number'
import type { Period } from '../../domain/period'
import { stepsDays, trimLeadingZeros } from '../../domain/steps'
import { LineChart } from '../charts/LineChart'
import { shortDate } from '../dates'
import { Card, SectionLabel } from '../Screen'
import styles from './Steps.module.css'

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, quarter: 90, all: 365 }

/**
 * «Прогресс» → «Графики» → «Шаги»: шаги по дням за выбранный период и цель пунктиром.
 * Шаги берутся из базы приложения — туда их переносит StepsSync из Health Connect,
 * поэтому график есть и за старые дни, и в браузере после восстановления копии.
 */
export function StepsChart({ period }: { period: Period }) {
  const repos = useRepos()
  const history = useLiveQuery(() => repos.meta.get('stepsHistory'), [repos])
  const [goal, setGoal] = useState(DEFAULT_STEPS_GOAL)

  useEffect(() => {
    if (!isAndroidApp()) return
    void Steps.status()
      .then((st) => st.goal && setGoal(st.goal))
      .catch(() => {})
  }, [])

  if (!history) return null
  const all = stepsDays(history, toISODate(new Date()), PERIOD_DAYS[period])
  const days = period === 'all' ? trimLeadingZeros(all) : all
  if (!days.some((d) => d.steps > 0)) return null
  const state = { goal }
  const average = Math.round(days.reduce((n, d) => n + d.steps, 0) / days.length)
  const reached = days.filter((d) => d.steps >= state.goal).length

  return (
    <>
      <SectionLabel>Шаги</SectionLabel>
      <Card>
        <h2 className={styles.chartTitle}>Шаги по дням</h2>
        <p className={styles.chartNote}>
          В среднем <b>{formatInteger(average)}</b> в день · цель выполнена {reached} из{' '}
          {days.length}
        </p>
        {days.length >= 2 ? (
          <LineChart
            points={days.map((d) => ({
              label: shortDate(d.date),
              values: { steps: d.steps, goal: state.goal },
            }))}
            series={[
              { key: 'steps', name: 'Шаги', color: 'var(--chart-1)' },
              { key: 'goal', name: 'Цель', color: 'var(--chart-2)', dashed: true },
            ]}
            format={(v) => formatInteger(Math.round(v))}
            ariaLabel={`Шаги по дням: ${days.length} дней, в среднем ${formatInteger(average)}`}
          />
        ) : (
          <p className={styles.chartNote}>Нет данных за этот период.</p>
        )}
      </Card>
    </>
  )
}
