// Интервальный таймер: табата, EMOM и круговая тренировка.
// Настройки разворачиваются в список фаз (подготовка, работа, отдых), а где мы сейчас —
// считается по часам от старта, а не по тикам: таймер не сбивается, если страница
// подвисла или телефон на минуту погасил экран.

export type IntervalMode = 'tabata' | 'emom' | 'circuit'

export const INTERVAL_MODE_LABELS: Record<IntervalMode, string> = {
  tabata: 'Табата',
  emom: 'EMOM',
  circuit: 'Круговая',
}

export interface IntervalConfig {
  /** Работа, с. В EMOM — длина интервала: упражнение в начале, остаток — отдых. */
  workSec: number
  /** Отдых между раундами, с; в EMOM не нужен. */
  restSec: number
  /** Раундов в круге: в табате — подходов, в EMOM — минут, в круговой — упражнений. */
  rounds: number
  /** Сколько кругов; в табате и EMOM обычно один. */
  laps: number
  /** Отдых между кругами, с. */
  lapRestSec: number
}

export const INTERVAL_DEFAULTS: Record<IntervalMode, IntervalConfig> = {
  tabata: { workSec: 20, restSec: 10, rounds: 8, laps: 1, lapRestSec: 60 },
  emom: { workSec: 60, restSec: 0, rounds: 10, laps: 1, lapRestSec: 0 },
  circuit: { workSec: 45, restSec: 15, rounds: 6, laps: 3, lapRestSec: 90 },
}

export interface IntervalPreset {
  id: string
  title: string
  mode: IntervalMode
  config: IntervalConfig
}

/** Готовые варианты: одним нажатием выставляют режим и все цифры. */
export const INTERVAL_PRESETS: IntervalPreset[] = [
  { id: 'tabata', title: 'Табата', mode: 'tabata', config: INTERVAL_DEFAULTS.tabata },
  {
    id: 'tabata-x2',
    title: 'Двойная табата',
    mode: 'tabata',
    config: { ...INTERVAL_DEFAULTS.tabata, laps: 2, lapRestSec: 60 },
  },
  { id: 'emom-10', title: 'EMOM', mode: 'emom', config: INTERVAL_DEFAULTS.emom },
  { id: 'emom-20', title: 'EMOM', mode: 'emom', config: { ...INTERVAL_DEFAULTS.emom, rounds: 20 } },
  {
    id: 'circuit-10',
    title: 'Круговая',
    mode: 'circuit',
    config: { workSec: 30, restSec: 15, rounds: 4, laps: 3, lapRestSec: 60 },
  },
  { id: 'circuit-20', title: 'Круговая', mode: 'circuit', config: INTERVAL_DEFAULTS.circuit },
]

export function sameConfig(a: IntervalConfig, b: IntervalConfig): boolean {
  return (Object.keys(a) as (keyof IntervalConfig)[]).every((k) => a[k] === b[k])
}

/** Длительность варианта целыми минутами, вместе с подготовкой: «4 мин». */
export function presetMinutes(p: IntervalPreset): number {
  const phases = intervalPhases(p.mode, p.config)
  return Math.round((intervalTotalSec(phases) + PREPARE_SEC) / 60)
}

export const INTERVAL_LIMITS = {
  workSec: { min: 5, max: 600 },
  restSec: { min: 0, max: 600 },
  rounds: { min: 1, max: 50 },
  laps: { min: 1, max: 20 },
  lapRestSec: { min: 0, max: 900 },
} as const

/** Отсчёт перед первым раундом, с: успеть встать на место. */
export const PREPARE_SEC = 10

export type PhaseKind = 'prepare' | 'work' | 'rest' | 'lapRest'

export interface IntervalPhase {
  kind: PhaseKind
  durationSec: number
  /** Раунд и круг, к которым относится фаза (с единицы); у отдыха — номер следующего раунда. */
  round: number
  lap: number
}

export function intervalPhases(mode: IntervalMode, c: IntervalConfig): IntervalPhase[] {
  const restSec = mode === 'emom' ? 0 : c.restSec
  const phases: IntervalPhase[] = [{ kind: 'prepare', durationSec: PREPARE_SEC, round: 1, lap: 1 }]
  for (let lap = 1; lap <= c.laps; lap++) {
    for (let round = 1; round <= c.rounds; round++) {
      phases.push({ kind: 'work', durationSec: c.workSec, round, lap })
      if (round < c.rounds && restSec > 0) {
        phases.push({ kind: 'rest', durationSec: restSec, round: round + 1, lap })
      }
    }
    if (lap < c.laps && c.lapRestSec > 0) {
      phases.push({ kind: 'lapRest', durationSec: c.lapRestSec, round: 1, lap: lap + 1 })
    }
  }
  return phases
}

/** Вся тренировка без подготовки, с. */
export function intervalTotalSec(phases: IntervalPhase[]): number {
  return phases.reduce((n, p) => n + (p.kind === 'prepare' ? 0 : p.durationSec), 0)
}

export interface IntervalPosition {
  /** Номер текущей фазы; равен длине списка, когда всё закончилось. */
  index: number
  /** Сколько осталось в текущей фазе, мс. */
  remainingMs: number
  /** Сколько осталось до конца всей тренировки, мс. */
  totalRemainingMs: number
  done: boolean
}

export function intervalPosition(phases: IntervalPhase[], elapsedMs: number): IntervalPosition {
  let start = 0
  const total = phases.reduce((n, p) => n + p.durationSec * 1000, 0)
  for (let i = 0; i < phases.length; i++) {
    const end = start + phases[i].durationSec * 1000
    if (elapsedMs < end) {
      return {
        index: i,
        remainingMs: end - elapsedMs,
        totalRemainingMs: total - elapsedMs,
        done: false,
      }
    }
    start = end
  }
  return { index: phases.length, remainingMs: 0, totalRemainingMs: 0, done: true }
}

/** Начало фазы от старта, мс — чтобы «пропустить» перескакивал ровно на следующую. */
export function phaseStartMs(phases: IntervalPhase[], index: number): number {
  let ms = 0
  for (let i = 0; i < index && i < phases.length; i++) ms += phases[i].durationSec * 1000
  return ms
}

/** Ход таймера: отсчёт от старта с вычетом пауз. */
export interface IntervalClock {
  startedAt: number
  /** Когда поставили на паузу; null — идёт. */
  pausedAt: number | null
  pausedMs: number
}

export function clockElapsed(c: IntervalClock, now: number): number {
  return (c.pausedAt ?? now) - c.startedAt - c.pausedMs
}

export function pauseClock(c: IntervalClock, now: number): IntervalClock {
  return c.pausedAt === null ? { ...c, pausedAt: now } : c
}

export function resumeClock(c: IntervalClock, now: number): IntervalClock {
  return c.pausedAt === null ? c : { ...c, pausedAt: null, pausedMs: c.pausedMs + now - c.pausedAt }
}

/** Перескочить к началу фазы `index`: сдвигаем старт назад, паузы не трогаем. */
export function seekClock(c: IntervalClock, now: number, targetMs: number): IntervalClock {
  return { ...c, startedAt: c.startedAt - (targetMs - clockElapsed(c, now)) }
}

export function phaseTitle(mode: IntervalMode, p: IntervalPhase): string {
  switch (p.kind) {
    case 'prepare':
      return 'Приготовьтесь'
    case 'rest':
      return 'Отдых'
    case 'lapRest':
      return 'Отдых между кругами'
    case 'work':
      if (mode !== 'emom') return 'Работа'
      return `${p.durationSec === 60 ? 'Минута' : 'Интервал'} ${p.round}`
  }
}
