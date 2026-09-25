import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router'
import { useRepos } from '../app/dataContext'
import { LineChart, type LinePoint, type LineSeries } from '../components/charts/LineChart'
import { EmptyState } from '../components/EmptyState'
import { Card, Screen, SectionLabel } from '../components/Screen'
import { Segmented } from '../components/Segmented'
import {
  activitySummary,
  exerciseHistory,
  exerciseUsage,
  parseISODate,
  personalRecords,
  type SessionStats,
} from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import { plural } from '../domain/plural'
import type { BodyWeight, Exercise, ExerciseType } from '../domain/types'
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
const TABLE_ROWS = 12

/** Какой график показан (ТЗ 9.6). Хранится в адресе: ?chart=working|sets|body. */
type ChartKind = 'working' | 'sets' | 'body'

interface ChartSpec {
  title: string
  series: LineSeries
  format: (v: number) => string
  points: LinePoint[]
  empty: string
}

function setsSummary(s: SessionStats, type: ExerciseType): string {
  const n = s.sets.length
  const values = s.sets
    .map((x) => (type === 'time' ? `${x.timeSec ?? 0} с` : String(x.reps)))
    .join(', ')
  return `${n} ${plural(n, 'подход', 'подхода', 'подходов')}: ${values}`
}

function exerciseChart(
  kind: 'working' | 'sets',
  history: SessionStats[],
  type: ExerciseType,
): ChartSpec {
  if (kind === 'working') {
    return {
      title: 'Рабочий вес, кг',
      series: { key: 'v', name: 'Рабочий вес', color: 'var(--chart-1)' },
      format: (v) => formatDecimal(Math.round(v * 2) / 2),
      points: history.map((s) => ({
        label: shortDate(s.date),
        values: { v: s.workingWeightKg },
        detail: s.sets.map((x) => formatSet(x, type)).join(', '),
      })),
      empty: 'Линия появится после второй тренировки.',
    }
  }
  const timed = type === 'time'
  return {
    title: timed ? 'Секунд за тренировку' : 'Повторов за тренировку',
    series: { key: 'v', name: timed ? 'Секунд' : 'Повторов', color: 'var(--chart-1)' },
    format: (v) => String(Math.round(v)),
    points: history.map((s) => ({
      label: shortDate(s.date),
      values: { v: timed ? s.totalTimeSec : s.totalReps },
      detail: setsSummary(s, type),
    })),
    empty: 'Линия появится после второй тренировки.',
  }
}

function bodyChart(rows: BodyWeight[]): ChartSpec {
  return {
    title: 'Вес тела, кг',
    series: { key: 'v', name: 'Вес', color: 'var(--chart-1)' },
    format: (v) => formatDecimal(Math.round(v * 10) / 10),
    points: rows.map((r) => ({ label: shortDate(r.date), values: { v: r.weightKg } })),
    empty: 'Запишите вес хотя бы два дня — во вкладке «Вес».',
  }
}

/** Прогресс (ТЗ 2.5, 9.6): графики с переключателем, рекорды, последние тренировки. */
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
    return { workouts, usage, exercises, body: await repos.bodyWeights.list() }
  }, [repos])

  if (!data) return null
  const { workouts, usage, exercises, body } = data

  if (workouts.length === 0 && body.length === 0) {
    return (
      <Screen title="Прогресс">
        <EmptyState title="Графиков пока нет">
          <p>Графики и рекорды появятся после первых тренировок.</p>
        </EmptyState>
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

  // «Рабочий вес» есть только у упражнений с весом; без тренировок остаётся только вес тела
  const chartOptions: { value: ChartKind; label: string }[] = [
    ...(exercise?.type === 'weight' ? [{ value: 'working' as const, label: 'Рабочий вес' }] : []),
    ...(exercise ? [{ value: 'sets' as const, label: 'Подходы' }] : []),
    { value: 'body', label: 'Вес тела' },
  ]
  const requestedChart = params.get('chart') as ChartKind | null
  const chartKind = chartOptions.some((o) => o.value === requestedChart)
    ? requestedChart!
    : chartOptions[0].value
  const chart =
    chartKind === 'body' || !exercise
      ? bodyChart(body)
      : exerciseChart(chartKind, history, exercise.type)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  const bestSet = history
    .flatMap((s) => s.sets)
    .reduce<SessionStats['sets'][number] | null>(
      (best, s) => (!best || s.weightKg * s.reps > best.weightKg * best.reps ? s : best),
      null,
    )
  const summary = activitySummary(workouts, new Date())

  return (
    <Screen title="Прогресс">
      {exercise && (
        <label className={styles.pickerField}>
          <span className={styles.label}>Упражнение</span>
          <select
            className={styles.picker}
            value={exId}
            onChange={(e) => setParam('ex', e.target.value)}
          >
            {options.map(([id, count]) => (
              <option key={id} value={id}>
                {exercises.get(id)!.name} · {count}
              </option>
            ))}
          </select>
        </label>
      )}

      {exercise && records && (
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
      )}

      <Card>
        {chartOptions.length > 1 && (
          <Segmented
            label="График"
            options={chartOptions}
            value={chartKind}
            onChange={(v) => setParam('chart', v)}
          />
        )}
        <h2 className={styles.cardTitle}>{chart.title}</h2>
        {chart.points.length >= 2 ? (
          <LineChart
            points={chart.points}
            series={[chart.series]}
            format={chart.format}
            ariaLabel={`${chart.title}${chartKind === 'body' ? '' : `, ${exercise?.name}`}: ${chart.points.length} ${plural(chart.points.length, 'точка', 'точки', 'точек')}`}
          />
        ) : (
          <p className={styles.muted}>{chart.empty}</p>
        )}
      </Card>

      {exercise && (
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
                      Рабочий
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
                        <td className={styles.numCol}>{formatDecimal(s.workingWeightKg)}</td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <SectionLabel>Все тренировки</SectionLabel>
      <div className={styles.tiles}>
        <Tile label="За 7 дней" value={`${summary.last7}`} />
        <Tile label="За 30 дней" value={`${summary.last30}`} />
        <Tile label="Всего" value={`${summary.total}`} />
      </div>
    </Screen>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
    </div>
  )
}
