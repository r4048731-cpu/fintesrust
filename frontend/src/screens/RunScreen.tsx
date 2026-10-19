import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { gpsAvailable } from '../app/gps'
import { Button } from '../components/Button'
import { Chips } from '../components/Field'
import { Icon } from '../components/Icon'
import { LiveCard, LiveIcon } from '../components/LiveCard'
import { RunHistory } from '../components/run/RunHistory'
import { Screen } from '../components/Screen'
import { Segmented } from '../components/Segmented'
import { Stepper } from '../components/Stepper'
import { ActiveRunExistsError } from '../data/repositories/runs'
import { formatKm, RUN_KINDS, type RunGoal, type RunIntervals, type RunKind } from '../domain/run'
import {
  describeIntervals,
  intervalsGoal,
  RUN_INTERVAL_LIMITS,
  RUN_INTERVAL_PRESETS,
  runIntervalsSec,
  shortIntervals,
} from '../domain/runIntervals'
import frame from '../components/frame.module.css'
import styles from './RunScreen.module.css'

type GoalKey = 'free' | 'd3' | 'd5' | 'd10' | 't20' | 't30' | 't60' | 'int'

const GOALS: { value: GoalKey; label: string; goal: RunGoal }[] = [
  { value: 'free', label: 'Свободно', goal: { type: 'free' } },
  { value: 'd3', label: '3 км', goal: { type: 'distance', meters: 3000 } },
  { value: 'd5', label: '5 км', goal: { type: 'distance', meters: 5000 } },
  { value: 'd10', label: '10 км', goal: { type: 'distance', meters: 10000 } },
  { value: 't20', label: '20 мин', goal: { type: 'time', sec: 20 * 60 } },
  { value: 't30', label: '30 мин', goal: { type: 'time', sec: 30 * 60 } },
  { value: 't60', label: '60 мин', goal: { type: 'time', sec: 60 * 60 } },
]

/** Интервалы — только для бега: у ходьбы сменять нечего. */
const RUN_GOALS = [...GOALS, { value: 'int' as const, label: 'Интервалы' }]

/** Счётчики интервалов: время — в минутах с шагом полминуты, повторы — штуки. */
const INTERVAL_FIELDS: { field: keyof RunIntervals; label: string; minutes: boolean }[] = [
  { field: 'runSec', label: 'Бег, мин', minutes: true },
  { field: 'walkSec', label: 'Шаг, мин', minutes: true },
  { field: 'rounds', label: 'Повторов', minutes: false },
  { field: 'warmupSec', label: 'Разминка, мин', minutes: true },
]

const sameIntervals = (a: RunIntervals, b: RunIntervals) =>
  (Object.keys(a) as (keyof RunIntervals)[]).every((k) => a[k] === b[k])

/** «Бег и ходьба»: выбор вида и цели, старт, итоги и последние пробежки. */
export function RunScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const active = useLiveQuery(() => repos.runs.getActive(), [repos])
  const [kind, setKind] = useState<RunKind>('run')
  const [goal, setGoal] = useState<GoalKey>('free')
  const [intervals, setIntervals] = useState<RunIntervals>(RUN_INTERVAL_PRESETS[0].intervals)
  const withIntervals = kind === 'run' && goal === 'int'
  const [error, setError] = useState<string | null>(null)
  const gps = gpsAvailable()

  async function start() {
    setError(null)
    try {
      if (withIntervals) await repos.runs.start(kind, intervalsGoal(intervals), intervals)
      else
        await repos.runs.start(kind, GOALS.find((g) => g.value === goal)?.goal ?? { type: 'free' })
    } catch (err) {
      if (!(err instanceof ActiveRunExistsError)) {
        setError('Не удалось начать. Попробуйте ещё раз.')
        return
      }
    }
    navigate('/run/active')
  }

  return (
    <Screen title="Бег и ходьба" onBack={() => navigate(-1)}>
      {active && (
        <LiveCard
          label={`${active.kind === 'run' ? 'Пробежка' : 'Прогулка'} идёт`}
          title={`${formatKm(active.distanceM)} км`}
          meta="Маршрут пишется · вернуться"
          onClick={() => navigate('/run/active')}
          lead={
            <LiveIcon>
              <Icon name="run" size={24} />
            </LiveIcon>
          }
        />
      )}

      {!active && (
        <section className={`${styles.start} ${frame.frame}`} aria-label="Новая пробежка">
          <svg className={styles.route} viewBox="0 0 200 120" aria-hidden="true">
            <path d="M8 104c26-6 30-40 58-44s34 22 60 14 18-48 44-56 20-4 22-8" />
            <circle cx="8" cy="104" r="4" />
            <circle cx="192" cy="10" r="5" />
          </svg>
          <div className={styles.startHead}>
            <span className={styles.startIcon} aria-hidden="true">
              <Icon name="run" size={24} />
            </span>
            <div>
              <h2 className={styles.startTitle}>
                {kind === 'run' ? 'Новая пробежка' : 'Новая прогулка'}
              </h2>
              <p className={styles.startGoal}>
                {withIntervals
                  ? `Интервалы: ${Math.round(runIntervalsSec(intervals) / 60)} мин`
                  : `Цель: ${(GOALS.find((g) => g.value === goal) ?? GOALS[0]).label.toLowerCase()}`}
              </p>
            </div>
          </div>
          <Segmented
            label="Вид"
            options={RUN_KINDS}
            value={kind}
            onChange={(k) => {
              setKind(k)
              if (k === 'walk' && goal === 'int') setGoal('free')
            }}
          />
          <Chips
            label="Цель"
            options={kind === 'run' ? RUN_GOALS : GOALS}
            value={goal}
            onChange={setGoal}
          />
          {withIntervals && <IntervalsSetup value={intervals} onChange={setIntervals} />}
          {!gps && (
            <p className={styles.warn} role="note">
              GPS работает только в защищённом режиме — по ссылке https://. Откройте приложение по
              такой ссылке после публикации.
            </p>
          )}
          <Button
            variant="primary"
            block
            icon="run"
            disabled={!gps}
            onClick={start}
            className={styles.go}
          >
            Старт
          </Button>
          {error && (
            <p role="alert" className={styles.warn}>
              {error}
            </p>
          )}
          <p className={styles.hint}>
            Пишем маршрут, пока приложение открыто: экран не гаснет. Телефон можно держать в руке
            или в кармане с включённым экраном.
          </p>
        </section>
      )}

      <RunHistory />
    </Screen>
  )
}

/** Интервалы «бег / шаг»: готовые варианты и счётчики. */
function IntervalsSetup({
  value,
  onChange,
}: {
  value: RunIntervals
  onChange: (v: RunIntervals) => void
}) {
  return (
    <div className={styles.intervals}>
      <div className={styles.presets} role="group" aria-label="Готовые интервалы">
        {RUN_INTERVAL_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.preset}
            aria-pressed={sameIntervals(p.intervals, value)}
            onClick={() => onChange(p.intervals)}
          >
            <b>{p.title}</b>
            <span>{shortIntervals(p.intervals)} мин</span>
          </button>
        ))}
      </div>
      <div className={styles.fields}>
        {INTERVAL_FIELDS.map(({ field, label, minutes }) => {
          const k = minutes ? 60 : 1
          return (
            <div key={field} className={styles.field}>
              <span className={styles.label}>{label}</span>
              <Stepper
                label={label}
                decimal={minutes}
                step={minutes ? 0.5 : 1}
                value={value[field] / k}
                min={RUN_INTERVAL_LIMITS[field].min / k}
                max={RUN_INTERVAL_LIMITS[field].max / k}
                onChange={(v) => onChange({ ...value, [field]: Math.round(v * k) })}
              />
            </div>
          )
        })}
      </div>
      <p className={styles.hint} role="status">
        {describeIntervals(value)} — всего {Math.round(runIntervalsSec(value) / 60)} мин. Голос и
        вибрация скажут, когда бежать и когда идти; пауза останавливает и интервалы.
      </p>
    </div>
  )
}
