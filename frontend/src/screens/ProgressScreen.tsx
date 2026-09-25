import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router'
import { useRepos } from '../app/dataContext'
import { BarChart } from '../components/charts/BarChart'
import { ChartLegend, LineChart, type LineSeries } from '../components/charts/LineChart'
import { BodyWeightCard } from '../components/BodyWeightCard'
import { EmptyState } from '../components/EmptyState'
import { Card, Screen, SectionLabel } from '../components/Screen'
import {
  activitySummary,
  exerciseHistory,
  exerciseUsage,
  parseISODate,
  personalRecords,
  weeklyTonnage,
  type SessionStats,
} from '../domain/metrics'
import { formatDecimal, formatInteger } from '../domain/number'
import { plural } from '../domain/plural'
import type { Exercise, ExerciseType } from '../domain/types'
import { formatSet } from '../domain/workout'
import styles from './ProgressScreen.module.css'

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]
const shortDate = (iso: string) => {
  const d = parseISODate(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}
const kg = (v: number) => `${formatDecimal(Math.round(v * 2) / 2)} кг`
const WEEKS = 10
const TABLE_ROWS = 12

/** Что рисовать для упражнения каждого типа. */
function seriesFor(type: ExerciseType): { series: LineSeries[]; format: (v: number) => string } {
  if (type === 'weight') {
    return {
      series: [
        { key: 'best', name: 'Лучший вес', color: 'var(--chart-1)' },
        { key: 'e1rm', name: 'Расчётный 1ПМ', color: 'var(--chart-2)', dashed: true },
      ],
      format: (v) => formatDecimal(Math.round(v * 2) / 2),
    }
  }
  if (type === 'bodyweight') {
    return {
      series: [{ key: 'reps', name: 'Лучший подход, повт.', color: 'var(--chart-1)' }],
      format: (v) => String(Math.round(v)),
    }
  }
  return {
    series: [{ key: 'time', name: 'Лучшее время, с', color: 'var(--chart-1)' }],
    format: (v) => String(Math.round(v)),
  }
}

function pointValues(s: SessionStats): Record<string, number> {
  return { best: s.bestWeightKg, e1rm: s.best1RM, reps: s.maxReps, time: s.maxTimeSec }
}

/** Прогресс (ТЗ 2.5): графики по упражнению, личные рекорды, общая статистика. */
export function ProgressScreen() {
  const repos = useRepos()
  const [params, setParams] = useSearchParams()

  const data = useLiveQuery(async () => {
    const workouts = await repos.workouts.listDone()
    const usage = exerciseUsage(workouts)
    const exercises = new Map<string, Exercise>()
    for (const id of usage.keys()) {
      const e = await repos.exercises.get(id)
      if (e) exercises.set(id, e)
    }
    return { workouts, usage, exercises }
  }, [repos])

  if (!data) return null
  const { workouts, usage, exercises } = data

  if (workouts.length === 0) {
    return (
      <Screen title="Прогресс">
        <EmptyState title="Графиков пока нет">
          <p>
            После первых тренировок здесь появятся графики веса и расчётного 1ПМ по каждому
            упражнению, личные рекорды и тоннаж по неделям.
          </p>
        </EmptyState>
        <BodyWeightCard />
      </Screen>
    )
  }

  const options = [...usage.entries()]
    .filter(([id]) => exercises.has(id))
    .sort(
      (a, b) =>
        b[1] - a[1] || exercises.get(a[0])!.name.localeCompare(exercises.get(b[0])!.name, 'ru'),
    )
  const requested = params.get('ex')
  const exId = requested && usage.has(requested) ? requested : options[0]?.[0]
  const exercise = exId ? exercises.get(exId) : undefined
  const history = exId ? exerciseHistory(workouts, exId) : []
  const records = personalRecords(history)
  const { series, format } = seriesFor(exercise?.type ?? 'weight')
  const points = history.map((s) => ({ label: shortDate(s.date), values: pointValues(s) }))
  const bestSet = history
    .flatMap((s) => s.sets)
    .reduce<(typeof history)[number]['sets'][number] | null>(
      (best, s) => (!best || s.weightKg * s.reps > best.weightKg * best.reps ? s : best),
      null,
    )

  const now = new Date()
  const summary = activitySummary(workouts, now)
  const weeks = weeklyTonnage(workouts, WEEKS, now)

  return (
    <Screen title="Прогресс">
      {exercise && records && (
        <>
          <label className={styles.pickerField}>
            <span className={styles.label}>Упражнение</span>
            <select
              className={styles.picker}
              value={exId}
              onChange={(e) => setParams({ ex: e.target.value }, { replace: true })}
            >
              {options.map(([id, count]) => (
                <option key={id} value={id}>
                  {exercises.get(id)!.name} · {count}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.tiles}>
            {exercise.type === 'weight' && (
              <>
                <Tile label="Макс. вес" value={kg(records.maxWeightKg)} />
                <Tile label="Расч. 1ПМ" value={kg(records.max1RM)} />
                <Tile label="Лучший подход" value={bestSet ? formatSet(bestSet, 'weight') : '—'} />
              </>
            )}
            {exercise.type === 'bodyweight' && (
              <>
                <Tile label="Макс. повторов" value={String(records.maxReps)} />
                <Tile label="Тренировок" value={String(history.length)} />
              </>
            )}
            {exercise.type === 'time' && (
              <>
                <Tile label="Лучшее время" value={`${records.maxTimeSec} с`} />
                <Tile label="Тренировок" value={String(history.length)} />
              </>
            )}
          </div>

          <Card>
            <h2 className={styles.cardTitle}>
              {exercise.type === 'weight' ? 'Вес по тренировкам, кг' : series[0].name}
            </h2>
            {series.length > 1 && points.length >= 2 && <ChartLegend series={series} />}
            {points.length >= 2 ? (
              <LineChart
                points={points}
                series={series}
                format={format}
                ariaLabel={`${exercise.name}: ${series.map((s) => s.name).join(' и ')} по ${points.length} тренировкам`}
              />
            ) : (
              <p className={styles.muted}>
                Пока одна тренировка с этим упражнением. Линия появится после второй.
              </p>
            )}
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>Последние тренировки</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Дата</th>
                    <th scope="col">Подходы</th>
                    {exercise.type === 'weight' && (
                      <th scope="col" className={styles.numCol}>
                        1ПМ
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...history]
                    .reverse()
                    .slice(0, TABLE_ROWS)
                    .map((s) => (
                      <tr key={s.workoutId}>
                        <td>{shortDate(s.date)}</td>
                        <td>{s.sets.map((set) => formatSet(set, exercise.type)).join(', ')}</td>
                        {exercise.type === 'weight' && (
                          <td className={styles.numCol}>{formatDecimal(Math.round(s.best1RM))}</td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <BodyWeightCard />

      <SectionLabel>Все тренировки</SectionLabel>
      <div className={styles.tiles}>
        <Tile
          label="За 7 дней"
          value={`${summary.last7}`}
          hint={plural(summary.last7, 'тренировка', 'тренировки', 'тренировок')}
        />
        <Tile
          label="За 30 дней"
          value={`${summary.last30}`}
          hint={plural(summary.last30, 'тренировка', 'тренировки', 'тренировок')}
        />
        <Tile
          label="Всего"
          value={`${summary.total}`}
          hint={plural(summary.total, 'тренировка', 'тренировки', 'тренировок')}
        />
      </div>
      <Card>
        <h2 className={styles.cardTitle}>Тоннаж по неделям, т</h2>
        <BarChart
          bars={weeks.map((w) => ({
            label: shortDate(w.weekStart),
            value: w.tonnageKg / 1000,
            detail: `${w.workouts} ${plural(w.workouts, 'тренировка', 'тренировки', 'тренировок')} · ${formatInteger(w.tonnageKg)} кг`,
          }))}
          format={(v) => formatDecimal(Math.round(v * 10) / 10)}
          ariaLabel={`Тоннаж по неделям за ${WEEKS} недель, текущая неделя: ${formatInteger(weeks[weeks.length - 1].tonnageKg)} кг`}
        />
      </Card>
    </Screen>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </div>
  )
}
