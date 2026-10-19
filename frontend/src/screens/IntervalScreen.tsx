import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { useNow } from '../app/hooks/useNow'
import { useWakeLock } from '../app/hooks/useWakeLock'
import { intervalSignal, unlockAudio } from '../app/signal'
import { Button, IconButton } from '../components/Button'
import { Card, Screen } from '../components/Screen'
import { Segmented } from '../components/Segmented'
import { Stepper } from '../components/Stepper'
import {
  clockElapsed,
  INTERVAL_DEFAULTS,
  INTERVAL_LIMITS,
  INTERVAL_MODE_LABELS,
  INTERVAL_PRESETS,
  intervalPhases,
  intervalPosition,
  intervalTotalSec,
  pauseClock,
  phaseStartMs,
  phaseTitle,
  presetMinutes,
  resumeClock,
  sameConfig,
  seekClock,
  type IntervalClock,
  type IntervalConfig,
  type IntervalMode,
  type IntervalPhase,
} from '../domain/interval'
import { formatClock } from '../domain/workout'
import styles from './IntervalScreen.module.css'

const MODES = (Object.keys(INTERVAL_MODE_LABELS) as IntervalMode[]).map((value) => ({
  value,
  label: INTERVAL_MODE_LABELS[value],
}))

const MODE_HINTS: Record<IntervalMode, string> = {
  tabata: '20 секунд работы на пределе, 10 отдыха, 8 раундов — 4 минуты.',
  emom: 'В начале каждой минуты — подход, оставшееся время — отдых.',
  circuit: 'Несколько упражнений подряд с коротким отдыхом, затем следующий круг.',
}

type Field = keyof IntervalConfig

const FIELDS: Record<IntervalMode, { field: Field; label: string; step: number }[]> = {
  tabata: [
    { field: 'workSec', label: 'Работа, с', step: 5 },
    { field: 'restSec', label: 'Отдых, с', step: 5 },
    { field: 'rounds', label: 'Раундов', step: 1 },
    { field: 'laps', label: 'Подходов', step: 1 },
    { field: 'lapRestSec', label: 'Между подходами, с', step: 15 },
  ],
  emom: [
    { field: 'workSec', label: 'Интервал, с', step: 15 },
    { field: 'rounds', label: 'Интервалов', step: 1 },
  ],
  circuit: [
    { field: 'rounds', label: 'Упражнений', step: 1 },
    { field: 'workSec', label: 'Работа, с', step: 5 },
    { field: 'restSec', label: 'Отдых, с', step: 5 },
    { field: 'laps', label: 'Кругов', step: 1 },
    { field: 'lapRestSec', label: 'Между кругами, с', step: 15 },
  ],
}

/** Интервальный таймер на весь экран: табата, EMOM, круговая — со звуком и вибрацией. */
export function IntervalScreen() {
  const repos = useRepos()
  const saved = useLiveQuery(() => repos.meta.get('intervalTimer'), [repos])
  if (saved === undefined) return null
  return <IntervalTimer saved={saved} />
}

type Saved = { mode: IntervalMode; configs: Record<IntervalMode, IntervalConfig> }

function IntervalTimer({ saved }: { saved: Saved | null }) {
  const repos = useRepos()
  const navigate = useNavigate()
  const [mode, setMode] = useState<IntervalMode>(saved?.mode ?? 'tabata')
  const [configs, setConfigs] = useState(saved?.configs ?? INTERVAL_DEFAULTS)
  const [clock, setClock] = useState<IntervalClock | null>(null)

  const config = configs[mode]
  const phases = intervalPhases(mode, config)

  function change(field: Field, value: number) {
    setConfigs({ ...configs, [mode]: { ...config, [field]: value } })
  }

  function start() {
    unlockAudio()
    void repos.meta.set('intervalTimer', { mode, configs })
    setClock({ startedAt: Date.now(), pausedAt: null, pausedMs: 0 })
  }

  if (clock) {
    return (
      <Running
        mode={mode}
        phases={phases}
        clock={clock}
        onClock={setClock}
        onStop={() => setClock(null)}
        onRestart={start}
      />
    )
  }

  const shown = FIELDS[mode].filter((f) => f.field !== 'lapRestSec' || config.laps > 1)
  return (
    <div className={styles.setup}>
      <Screen title="Интервальный таймер" onBack={() => navigate(-1)}>
        <div className={styles.presets} role="group" aria-label="Готовые варианты">
          {INTERVAL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.preset}
              aria-pressed={p.mode === mode && sameConfig(p.config, config)}
              onClick={() => {
                setMode(p.mode)
                setConfigs({ ...configs, [p.mode]: p.config })
              }}
            >
              <b>{p.title}</b> <span>{presetMinutes(p)} мин</span>
            </button>
          ))}
        </div>
        <Segmented label="Режим" options={MODES} value={mode} onChange={setMode} />
        <p className={styles.hint}>{MODE_HINTS[mode]}</p>
        <Card>
          <div className={styles.fields}>
            {shown.map(({ field, label, step }) => (
              <div key={field} className={styles.field}>
                <span className={styles.label}>{label}</span>
                <Stepper
                  label={label}
                  value={config[field]}
                  step={step}
                  min={INTERVAL_LIMITS[field].min}
                  max={INTERVAL_LIMITS[field].max}
                  onChange={(v) => change(field, v)}
                />
              </div>
            ))}
          </div>
        </Card>
        <p className={styles.total} role="status">
          Всего <b>{formatClock(intervalTotalSec(phases))}</b> и{' '}
          {formatClock(phases[0].durationSec)} на подготовку
        </p>
        <Button variant="primary" block onClick={start}>
          Старт
        </Button>
        <p className={styles.hint}>
          Экран не гаснет, пока идёт таймер. На iPhone в беззвучном режиме останется только цвет.
        </p>
      </Screen>
    </div>
  )
}

function roundText(mode: IntervalMode, p: IntervalPhase, phases: IntervalPhase[]): string {
  const last = phases[phases.length - 1]
  const rounds = Math.max(...phases.map((x) => x.round))
  const laps = last.lap
  const unit = mode === 'circuit' ? 'Упражнение' : mode === 'emom' ? 'Интервал' : 'Раунд'
  const lapUnit = mode === 'circuit' ? 'круг' : 'подход'
  const lap = laps > 1 ? ` · ${lapUnit} ${p.lap} из ${laps}` : ''
  return `${unit} ${p.round} из ${rounds}${lap}`
}

function Running({
  mode,
  phases,
  clock,
  onClock,
  onStop,
  onRestart,
}: {
  mode: IntervalMode
  phases: IntervalPhase[]
  clock: IntervalClock
  onClock: (c: IntervalClock) => void
  onStop: () => void
  onRestart: () => void
}) {
  const paused = clock.pausedAt !== null
  const now = useNow(200, !paused)
  const pos = intervalPosition(phases, clockElapsed(clock, now))
  useWakeLock(!paused && !pos.done)

  // Сигналы: смена фазы и тиканье на последних трёх секундах
  const lastIndex = useRef(pos.index)
  const lastTick = useRef<number | null>(null)
  useEffect(() => {
    if (pos.index !== lastIndex.current) {
      lastIndex.current = pos.index
      lastTick.current = null
      const kind = pos.done ? 'finish' : phases[pos.index].kind
      // На подготовку («Ещё раз») не гудим — её начинает само нажатие
      if (kind !== 'prepare') intervalSignal(kind === 'lapRest' ? 'rest' : kind)
      return
    }
    const sec = Math.ceil(pos.remainingMs / 1000)
    if (!pos.done && !paused && sec <= 3 && sec >= 1 && sec !== lastTick.current) {
      lastTick.current = sec
      intervalSignal('tick')
    }
  }, [pos.index, pos.done, pos.remainingMs, paused, phases])

  if (pos.done) {
    return (
      <div className={styles.page} data-kind="done">
        <div className={styles.center}>
          <p className={styles.phase}>Готово!</p>
          <p className={styles.clock}>{formatClock(intervalTotalSec(phases))}</p>
          <p className={styles.round}>
            {INTERVAL_MODE_LABELS[mode]} · {phases.filter((p) => p.kind === 'work').length} рабочих
            интервалов
          </p>
        </div>
        <div className={styles.controls}>
          <Button block onClick={onStop}>
            К настройкам
          </Button>
          <Button variant="primary" block onClick={onRestart}>
            Ещё раз
          </Button>
        </div>
      </div>
    )
  }

  const phase = phases[pos.index]
  const next = phases[pos.index + 1]
  const progress = 1 - pos.remainingMs / (phase.durationSec * 1000)

  return (
    <div className={styles.page} data-kind={phase.kind}>
      <div className={styles.top}>
        <span className={styles.mode}>{INTERVAL_MODE_LABELS[mode]}</span>
        <span className={styles.left}>осталось {formatClock(pos.totalRemainingMs / 1000)}</span>
        <IconButton icon="close" label="Остановить" variant="secondary" onClick={onStop} />
      </div>

      <div className={styles.center}>
        <p className={styles.phase} aria-live="polite">
          {phaseTitle(mode, phase)}
        </p>
        <p className={styles.clock} role="timer">
          {formatClock(Math.ceil(pos.remainingMs / 1000))}
        </p>
        <p className={styles.round}>{roundText(mode, phase, phases)}</p>
        <div className={styles.bar} aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
        {next && (
          <p className={styles.next}>
            Дальше: {phaseTitle(mode, next)} · {formatClock(next.durationSec)}
          </p>
        )}
      </div>

      <div className={styles.controls}>
        <Button
          block
          onClick={() => onClock(seekClock(clock, Date.now(), phaseStartMs(phases, pos.index + 1)))}
        >
          Пропустить
        </Button>
        <Button
          variant="primary"
          block
          onClick={() => {
            unlockAudio()
            const t = Date.now()
            onClock(paused ? resumeClock(clock, t) : pauseClock(clock, t))
          }}
        >
          {paused ? 'Продолжить' : 'Пауза'}
        </Button>
      </div>
    </div>
  )
}
