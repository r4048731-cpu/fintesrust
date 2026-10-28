import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { useRepos } from '../app/dataContext'
import { LineChart, type LinePoint, type LineSeries } from '../components/charts/LineChart'
import { shortDate } from '../components/dates'
import { StepsChart } from '../components/steps/StepsChart'
import { Card, SectionLabel } from '../components/Screen'
import { measureSeries } from '../data/repositories/measurements'
import { countable, toISODate, weeklyTonnage, workoutTonnage } from '../domain/metrics'
import { addDays, dailyTotals } from '../domain/nutrition'
import { formatDecimal, formatInteger } from '../domain/number'
import { inPeriod, type Period } from '../domain/period'
import { formatPace, paceSecPerKm } from '../domain/run'
import { FIGURE_ORDER, MEASURE_LABELS, type ISODate, type MeasureKey } from '../domain/types'
import styles from './ProgressScreen.module.css'

const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { week: 7, month: 30, quarter: 90 }

/** Сколько дней показывать в графиках «по дням»: период или, для «всё время», с первой записи (до года). */
function spanDays(period: Period, first: ISODate | undefined, today: ISODate): number {
  if (period !== 'all') return PERIOD_DAYS[period]
  if (!first) return 7
  const days = Math.round((Date.parse(today) - Date.parse(first)) / 86_400_000) + 1
  return Math.min(365, Math.max(7, days))
}

const one = (v: number) => formatDecimal(Math.round(v * 10) / 10)
const whole = (v: number) => formatInteger(Math.round(v))

interface Spec {
  title: string
  points: LinePoint[]
  series: LineSeries[]
  format: (v: number) => string
}

/** Карточка графика; меньше двух точек — подсказка вместо линии. */
function ChartCard({ title, points, series, format, children }: Spec & { children?: ReactNode }) {
  return (
    <Card>
      <h2 className={styles.cardTitle}>{title}</h2>
      {children}
      {points.length >= 2 ? (
        <LineChart
          points={points}
          series={series}
          format={format}
          ariaLabel={`${title}: ${points.length} точек, последнее ${format(points.at(-1)!.values[series[0].key] ?? 0)}`}
        />
      ) : (
        <p className={styles.muted}>Нет данных за этот период.</p>
      )}
    </Card>
  )
}

/**
 * «Прогресс» → «Графики», ниже графика упражнения: все остальные графики прогресса —
 * тренировки по неделям, тело, питание, вода и сон, шаги, бег. Раздел показывается, только если в нём есть записи.
 */
export function AllCharts({ period }: { period: Period }) {
  const repos = useRepos()
  const [measure, setMeasure] = useState<MeasureKey>('waist')
  const today = toISODate(new Date())
  const data = useLiveQuery(async () => {
    const [workouts, weights, measurements, meals, trackers, plan, runs] = await Promise.all([
      repos.workouts.listDone(),
      repos.bodyWeights.list(),
      repos.measurements.list(),
      repos.meals.listRange('0000-01-01', today),
      repos.meta.get('dayTrackers'),
      repos.meta.get('nutritionPlan'),
      repos.runs.list(),
    ])
    return { workouts, weights, measurements, meals, trackers, plan, runs }
  }, [repos, today])
  if (!data) return null
  const { workouts, weights, measurements, meals, trackers, plan, runs } = data

  // ——— Тренировки по неделям ———
  const done = countable(workouts)
  const firstWorkout = done.map((w) => w.date).sort()[0]
  const weeks = Math.ceil(spanDays(period, firstWorkout, today) / 7)
  const byWeek = weeklyTonnage(workouts, Math.max(2, weeks), new Date())
  const weekLabel = (iso: ISODate) => `с ${shortDate(iso)}`
  const timed = inPeriod(
    done.filter((w) => w.finishedAt && !w.manual),
    period,
    today,
  )

  // ——— Тело ———
  const weightRows = inPeriod(weights, period, today)
  const measureOptions = FIGURE_ORDER.filter((k) => measurements.some((m) => m.values[k]))
  const measureKey = measureOptions.includes(measure) ? measure : measureOptions[0]
  const measureRows = measureKey
    ? inPeriod(measureSeries(measurements, measureKey), period, today)
    : []

  // ——— Питание, вода, сон по дням ———
  const firstMeal = meals[0]?.date
  const foodDays = meals.length ? dailyTotals(meals, today, spanDays(period, firstMeal, today)) : []
  const trackerDates = Object.keys(trackers).sort()
  const trackerSpan = trackerDates.length ? spanDays(period, trackerDates[0], today) : 0
  const trackerDays = Array.from({ length: trackerSpan }, (_, i) => {
    const date = addDays(today, i - trackerSpan + 1)
    return { date, ...trackers[date] }
  })
  const hasWater = trackerDates.some((d) => trackers[d].waterMl)
  const hasSleep = trackerDates.some((d) => trackers[d].sleepMin)

  // ——— Бег ———
  const runRows = inPeriod(
    runs
      .filter((r) => r.status === 'done' && r.distanceM > 0)
      .map((r) => ({ ...r, date: toISODate(new Date(r.startedAt)) }))
      .sort((a, b) => a.startedAt - b.startedAt),
    period,
    today,
  )

  return (
    <>
      {done.length > 0 && (
        <>
          <SectionLabel>Тренировки</SectionLabel>
          <ChartCard
            title="Тоннаж по неделям, кг"
            points={byWeek.map((w) => ({
              label: weekLabel(w.weekStart),
              values: { t: w.tonnageKg },
              detail: `${w.workouts} трен.`,
            }))}
            series={[{ key: 't', name: 'Тоннаж', color: 'var(--chart-1)' }]}
            format={whole}
          />
          <ChartCard
            title="Тренировок в неделю"
            points={byWeek.map((w) => ({
              label: weekLabel(w.weekStart),
              values: { n: w.workouts },
            }))}
            series={[{ key: 'n', name: 'Тренировок', color: 'var(--chart-2)' }]}
            format={whole}
          />
          <ChartCard
            title="Длительность тренировки, мин"
            points={timed.map((w) => ({
              label: shortDate(w.date),
              values: { m: (w.finishedAt! - w.startedAt) / 60_000 },
              detail: w.name,
            }))}
            series={[{ key: 'm', name: 'Минут', color: 'var(--chart-1)' }]}
            format={whole}
          />
          <ChartCard
            title="Тоннаж за тренировку, кг"
            points={inPeriod(done, period, today).map((w) => ({
              label: shortDate(w.date),
              values: { t: workoutTonnage(w) },
              detail: w.name,
            }))}
            series={[{ key: 't', name: 'Тоннаж', color: 'var(--chart-2)' }]}
            format={whole}
          />
        </>
      )}

      {(weights.length > 0 || measureOptions.length > 0) && (
        <>
          <SectionLabel>Тело</SectionLabel>
          {weights.length > 0 && (
            <ChartCard
              title="Вес тела, кг"
              points={weightRows.map((r) => ({
                label: shortDate(r.date),
                values: { kg: r.weightKg },
              }))}
              series={[{ key: 'kg', name: 'Вес', color: 'var(--chart-1)' }]}
              format={one}
            />
          )}
          {measureKey && (
            <ChartCard
              title={`${MEASURE_LABELS[measureKey]}, см`}
              points={measureRows.map((p) => ({ label: shortDate(p.date), values: { cm: p.cm } }))}
              series={[{ key: 'cm', name: MEASURE_LABELS[measureKey], color: 'var(--chart-2)' }]}
              format={one}
            >
              {measureOptions.length > 1 && (
                <div className={styles.chips} role="group" aria-label="Замер на графике">
                  {measureOptions.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={styles.chip}
                      aria-pressed={k === measureKey}
                      onClick={() => setMeasure(k)}
                    >
                      {MEASURE_LABELS[k]}
                    </button>
                  ))}
                </div>
              )}
            </ChartCard>
          )}
        </>
      )}

      {meals.length > 0 && (
        <>
          <SectionLabel>Питание</SectionLabel>
          <ChartCard
            title="Калории по дням"
            points={foodDays.map((d) => ({
              label: shortDate(d.date),
              values: { kcal: d.total.calories, ...(plan ? { plan: plan.calories } : {}) },
            }))}
            series={[
              { key: 'kcal', name: 'Съедено', color: 'var(--chart-1)' },
              ...(plan
                ? [{ key: 'plan', name: 'План', color: 'var(--chart-2)', dashed: true }]
                : []),
            ]}
            format={whole}
          />
          <ChartCard
            title="Белки, жиры, углеводы по дням, г"
            points={foodDays.map((d) => ({
              label: shortDate(d.date),
              values: { p: d.total.protein, f: d.total.fat, c: d.total.carbs },
            }))}
            series={[
              { key: 'p', name: 'Белки', color: 'var(--blue)' },
              { key: 'f', name: 'Жиры', color: 'var(--pink)' },
              { key: 'c', name: 'Углеводы', color: 'var(--violet)' },
            ]}
            format={whole}
          />
        </>
      )}

      {(hasWater || hasSleep) && (
        <>
          <SectionLabel>Вода и сон</SectionLabel>
          {hasWater && (
            <ChartCard
              title="Вода по дням, л"
              points={trackerDays.map((d) => ({
                label: shortDate(d.date),
                values: { l: (d.waterMl ?? 0) / 1000 },
              }))}
              series={[{ key: 'l', name: 'Вода', color: '#38bdf8' }]}
              format={(v) => formatDecimal(Math.round(v * 100) / 100)}
            />
          )}
          {hasSleep && (
            <ChartCard
              title="Сон по дням, ч"
              points={trackerDays.map((d) => ({
                label: shortDate(d.date),
                values: { h: (d.sleepMin ?? 0) / 60 },
              }))}
              series={[{ key: 'h', name: 'Сон', color: 'var(--violet)' }]}
              format={one}
            />
          )}
        </>
      )}

      {/* Шаги переносятся из Health Connect в Android-версии; в браузере — из резервной копии */}
      <StepsChart period={period} />

      {runRows.length > 0 && (
        <>
          <SectionLabel>Бег и ходьба</SectionLabel>
          <ChartCard
            title="Дистанция, км"
            points={runRows.map((r) => ({
              label: shortDate(r.date),
              values: { km: r.distanceM / 1000 },
              detail: r.kind === 'run' ? 'бег' : 'ходьба',
            }))}
            series={[{ key: 'km', name: 'Км', color: 'var(--chart-1)' }]}
            format={(v) => formatDecimal(Math.round(v * 100) / 100)}
          />
          <ChartCard
            title="Темп, мин/км"
            points={runRows.flatMap((r) => {
              const pace = paceSecPerKm(r.distanceM, r.movingMs)
              return pace ? [{ label: shortDate(r.date), values: { p: pace / 60 } }] : []
            })}
            series={[{ key: 'p', name: 'Темп', color: 'var(--chart-2)' }]}
            format={(v) => formatPace(v * 60)}
          />
        </>
      )}
    </>
  )
}
