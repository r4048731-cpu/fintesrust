import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import {
  MEASURE_LIMITS,
  MeasurementError,
  measureSeries,
  measureTrend,
  waistToHeight,
} from '../data/repositories/measurements'
import { toISODate } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import {
  FIGURE_ORDER,
  MEASURE_KEYS,
  MEASURE_LABELS,
  type MeasureKey,
  type Measurement,
} from '../domain/types'
import { inPeriod, type Period } from '../domain/period'
import { BodyFigure } from './BodyFigure'
import { Button } from './Button'
import { PeriodSelect } from './charts/PeriodSelect'
import { LineChart } from './charts/LineChart'
import { shortDate } from './dates'
import { Card } from './Screen'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'
import styles from './BodyMeasurements.module.css'

const cm = (v: number) => `${formatDecimal(v)} см`
const signed = (v: number) => (v === 0 ? '0 см' : `${v > 0 ? '+' : '−'}${cm(Math.abs(v))}`)

/** «Прогресс» → «Тело»: фигура с обхватами, изменения и график выбранного замера за период. */
export function BodyMeasurements() {
  const repos = useRepos()
  const rows = useLiveQuery(() => repos.measurements.list(), [repos])
  const profile = useLiveQuery(() => repos.meta.get('bodyProfile'), [repos])
  const [chartKey, setChartKey] = useState<MeasureKey>('waist')
  const [period, setPeriod] = useState<Period>('all')
  /** Открытая шторка: новая запись или правка существующей. */
  const [editing, setEditing] = useState<Measurement | 'new' | null>(null)
  // форма шторки пересоздаётся при каждом открытии, а при закрытии остаётся до конца анимации
  const [opened, setOpened] = useState(0)
  const open = (target: Measurement | 'new') => {
    setEditing(target)
    setOpened((n) => n + 1)
  }
  if (!rows) return null

  const last = rows.at(-1)
  const allSeries = measureSeries(rows, chartKey)
  const series = inPeriod(allSeries, period, toISODate(new Date()))
  const waist = measureTrend(rows, 'waist')
  const ratio = waist && profile ? waistToHeight(waist.cm, profile.heightCm) : null

  return (
    <Card framed className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>Замеры тела</h2>
        {rows.length > 0 && (
          <Button size="sm" icon="plus" onClick={() => open('new')}>
            Добавить
          </Button>
        )}
      </div>

      {/* Как в приложениях замеров: фигура слева, обхваты справа сверху вниз */}
      <div className={styles.figureRow}>
        <BodyFigure active={chartKey} />
        <div className={styles.tiles} role="group" aria-label="Замер для графика">
          {FIGURE_ORDER.map((key) => {
            const t = measureTrend(rows, key)
            return (
              <button
                key={key}
                type="button"
                className={styles.tile}
                aria-pressed={key === chartKey}
                // пока замеров нет, нажатие сразу открывает запись
                onClick={() => (rows.length ? setChartKey(key) : open('new'))}
              >
                <span className={styles.label}>{MEASURE_LABELS[key]}</span>
                <b>{t ? cm(t.cm) : '—'}</b>
                {t?.change !== null && t?.change !== undefined && (
                  <span className={trendClass(key, t.change)}>{signed(t.change)}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p>
            Талия часто уходит раньше, чем вес. Мерьте раз в 1–2 недели утром, лентой на одном
            уровне, не втягивая живот.
          </p>
          <Button variant="primary" size="sm" icon="plus" onClick={() => open('new')}>
            Записать замеры
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.chartHead}>
            <h3 className={styles.chartTitle}>{MEASURE_LABELS[chartKey]}, см</h3>
            <PeriodSelect value={period} onChange={setPeriod} label="Период графика замеров" />
          </div>
          {series.length >= 2 ? (
            <LineChart
              points={series.map((p) => ({ label: shortDate(p.date), values: { cm: p.cm } }))}
              series={[{ key: 'cm', name: MEASURE_LABELS[chartKey], color: 'var(--chart-2)' }]}
              format={(v) => formatDecimal(Math.round(v * 10) / 10)}
              ariaLabel={`${MEASURE_LABELS[chartKey]} по ${series.length} замерам, последний ${cm(series[series.length - 1].cm)}`}
            />
          ) : (
            <p className={styles.hint}>
              {allSeries.length >= 2
                ? 'Нет данных за этот период.'
                : `График «${MEASURE_LABELS[chartKey].toLowerCase()}» появится после второго замера.`}
            </p>
          )}

          {ratio !== null && (
            <p className={styles.ratio}>
              Талия / рост:{' '}
              <b className={ratio < 0.5 ? styles.good : styles.warn}>{formatDecimal(ratio)}</b>{' '}
              <span>— норма меньше 0,5</span>
            </p>
          )}

          <ul className={styles.list} aria-label="Замеры по датам">
            {[...rows].reverse().map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => open(r)}
                  aria-label={`Замеры за ${shortDate(r.date)} — изменить`}
                >
                  <b>{shortDate(r.date)}</b>
                  <span>
                    {MEASURE_KEYS.filter((k) => r.values[k] !== undefined)
                      .map((k) => `${MEASURE_LABELS[k]} ${formatDecimal(r.values[k]!)}`)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <MeasureSheet key={opened} editing={editing} last={last} onClose={() => setEditing(null)} />
    </Card>
  )
}

/** Талия, живот, бёдра и бедро: уменьшение — зелёным; грудь, плечи и бицепс — без оценки. */
function trendClass(key: MeasureKey, change: number): string {
  if (change === 0 || !['waist', 'belly', 'hips', 'thigh'].includes(key)) return styles.same
  return change < 0 ? styles.good : styles.warn
}

function MeasureSheet({
  editing,
  last,
  onClose,
}: {
  editing: Measurement | 'new' | null
  last: Measurement | undefined
  onClose: () => void
}) {
  const repos = useRepos()
  const today = toISODate(new Date())
  const row = editing === 'new' ? null : editing
  // новая запись — от прошлых значений: обычно меняется на сантиметр-другой
  const start = row?.values ?? last?.values ?? {}
  const [values, setValues] = useState<Partial<Record<MeasureKey, number>>>(start)
  const [date, setDate] = useState(row?.date ?? today)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    try {
      await repos.measurements.record(values, date)
      onClose()
    } catch (err) {
      setError(err instanceof MeasurementError ? err.message : 'Не удалось сохранить')
    }
  }

  return (
    <Sheet
      open={editing !== null}
      onClose={onClose}
      title={row ? `Замеры за ${shortDate(row.date)}` : 'Новые замеры'}
      footer={
        <div className={styles.actions}>
          {row && (
            <Button
              variant="danger"
              onClick={async () => {
                onClose()
                await repos.measurements.remove(row.id)
              }}
            >
              Удалить
            </Button>
          )}
          <Button icon="check" variant="primary" block onClick={() => void save()}>
            Сохранить
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        {!row && (
          <label className={styles.field}>
            <span className={styles.label}>Дата</span>
            <input
              type="date"
              className={styles.date}
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
        )}
        <div className={styles.grid}>
          {FIGURE_ORDER.map((key) => (
            <div key={key} className={styles.field}>
              <span className={styles.label} aria-hidden="true">
                {MEASURE_LABELS[key]}, см
              </span>
              <Stepper
                label={`${MEASURE_LABELS[key]}, см`}
                value={values[key] ?? 0}
                step={0.5}
                decimal
                max={MEASURE_LIMITS.max}
                onChange={(v) => setValues((cur) => ({ ...cur, [key]: v }))}
              />
            </div>
          ))}
        </div>
        <p className={styles.hint}>0 — не мерили. Бедро и бицепс — по самому широкому месту.</p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}
