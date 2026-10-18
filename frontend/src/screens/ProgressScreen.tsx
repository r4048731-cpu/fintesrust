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
import type { Exercise, ExerciseType } from '../domain/types'
import { formatSet } from '../domain/workout'
import { RunHistory } from '../components/run/RunHistory'
import { HistoryPanel } from './HistoryPanel'
import { WeightPanel } from './WeightPanel'
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

/** Какой график показан (ТЗ 9.6). Хранится в адресе: ?chart=working|sets. */
type ChartKind = 'working' | 'sets'

/** Раздел вкладки. Хранится в адресе: ?view=history|charts|weight|runs. */
type View = 'history' | 'charts' | 'weight' | 'runs'

const VIEWS: { value: View; label: string }[] = [
  { value: 'history', label: 'История' },
  { value: 'charts', label: 'Графики' },
  { value: 'weight', label: 'Вес тела' },
  { value: 'runs', label: 'Бег' },
]

/** Адрес раздела; старое ?view=workouts — это нынешние «Графики». */
function viewOf(requested: string | null, hasWorkouts: boolean, hasWeights: boolean): View {
  if (requested === 'workouts' || requested === 'charts') return 'charts'
  if (requested === 'history' || requested === 'weight' || requested === 'runs') return requested
  return !hasWorkouts && hasWeights ? 'weight' : 'history'
}

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

/**
 * Прогресс (ТЗ 2.5, 9.6): два раздела — тренировки (графики, рекорды) и вес тела.
 * Без тренировок, но с записями веса сразу открывается вес.
 */
export function ProgressScreen() {
  const repos = useRepos()
  const [params, setParams] = useSearchParams()
  const hasWorkouts = useLiveQuery(
    async () => (await repos.workouts.listDone()).length > 0,
    [repos],
  )
  const hasWeights = useLiveQuery(async () => (await repos.bodyWeights.list()).length > 0, [repos])
  if (hasWorkouts === undefined || hasWeights === undefined) return null

  const view = viewOf(params.get('view'), hasWorkouts, hasWeights)

  return (
    <Screen title="Прогресс">
      <Segmented
        label="Раздел"
        options={VIEWS}
        value={view}
        onChange={(v) => {
          const next = new URLSearchParams(params)
          next.set('view', v)
          setParams(next, { replace: true })
        }}
      />
      {view === 'history' ? (
        <HistoryPanel />
      ) : view === 'weight' ? (
        <WeightPanel />
      ) : view === 'runs' ? (
        <RunHistory />
      ) : (
        <WorkoutProgress />
      )}
    </Screen>
  )
}

/** Графики по упражнениям с переключателем, рекорды, последние тренировки. */
function WorkoutProgress() {
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
      <EmptyState title="Графиков пока нет" icon="progress">
        <p>Графики и рекорды появятся после первых тренировок.</p>
      </EmptyState>
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

  // «Рабочий вес» есть только у упражнений с весом
  const chartOptions: { value: ChartKind; label: string }[] = [
    ...(exercise?.type === 'weight' ? [{ value: 'working' as const, label: 'Рабочий вес' }] : []),
    { value: 'sets', label: 'Подходы' },
  ]
  const requestedChart = params.get('chart') as ChartKind | null
  const chartKind = chartOptions.some((o) => o.value === requestedChart)
    ? requestedChart!
    : chartOptions[0].value
  const chart = exerciseChart(chartKind, history, exercise?.type ?? 'weight')

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
    <>
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

      <Card framed>
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
            ariaLabel={`${chart.title}, ${exercise?.name}: ${chart.points.length} ${plural(chart.points.length, 'точка', 'точки', 'точек')}`}
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
    </>
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
