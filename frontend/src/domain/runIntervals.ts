// Интервалы в беге: разминка шагом, потом «бег / шаг» по очереди — как в программах
// «с нуля до 5 км». Где мы сейчас, считается по времени в движении: пауза останавливает
// и интервалы, а после перезагрузки страницы фаза та же.

import { intervalPosition } from './interval'
import type { RunGoal, RunIntervals } from './run'

export type RunPhaseKind = 'warmup' | 'run' | 'walk'

export interface RunPhase {
  kind: RunPhaseKind
  durationSec: number
  /** Номер повтора «бег + шаг», с единицы; у разминки — 0. */
  round: number
}

export interface RunIntervalPreset {
  id: string
  title: string
  intervals: RunIntervals
}

const MIN = 60

/** Готовые варианты: от «бегу первый раз» до «почти без шага». */
export const RUN_INTERVAL_PRESETS: RunIntervalPreset[] = [
  {
    id: 'start',
    title: 'Новичок',
    intervals: { warmupSec: 5 * MIN, runSec: 1 * MIN, walkSec: 1.5 * MIN, rounds: 8 },
  },
  {
    id: 'easy',
    title: 'Втягиваюсь',
    intervals: { warmupSec: 5 * MIN, runSec: 2 * MIN, walkSec: 2 * MIN, rounds: 6 },
  },
  {
    id: 'mid',
    title: 'Уверенно',
    intervals: { warmupSec: 5 * MIN, runSec: 5 * MIN, walkSec: 2 * MIN, rounds: 4 },
  },
  {
    id: 'fast',
    title: 'Ускорения',
    intervals: { warmupSec: 5 * MIN, runSec: 1 * MIN, walkSec: 1 * MIN, rounds: 10 },
  },
]

export const RUN_INTERVAL_LIMITS = {
  warmupSec: { min: 0, max: 20 * MIN },
  runSec: { min: 30, max: 30 * MIN },
  walkSec: { min: 30, max: 10 * MIN },
  rounds: { min: 1, max: 30 },
} as const

/** Разминка, затем бег и шаг; после последнего бега шага нет — дальше свободно. */
export function runPhases(c: RunIntervals): RunPhase[] {
  const phases: RunPhase[] = []
  if (c.warmupSec > 0) phases.push({ kind: 'warmup', durationSec: c.warmupSec, round: 0 })
  for (let round = 1; round <= c.rounds; round++) {
    phases.push({ kind: 'run', durationSec: c.runSec, round })
    if (round < c.rounds) phases.push({ kind: 'walk', durationSec: c.walkSec, round })
  }
  return phases
}

/** Вся тренировка, с. */
export function runIntervalsSec(c: RunIntervals): number {
  return runPhases(c).reduce((n, p) => n + p.durationSec, 0)
}

/** Цель пробежки с интервалами — их общее время. */
export function intervalsGoal(c: RunIntervals): RunGoal {
  return { type: 'time', sec: runIntervalsSec(c) }
}

export interface RunPhasePosition {
  phase: RunPhase | null
  index: number
  remainingMs: number
  next: RunPhase | null
  done: boolean
}

export function runPhaseAt(phases: RunPhase[], movingMs: number): RunPhasePosition {
  const pos = intervalPosition(phases, movingMs)
  return {
    phase: phases[pos.index] ?? null,
    index: pos.index,
    remainingMs: pos.remainingMs,
    next: phases[pos.index + 1] ?? null,
    done: pos.done,
  }
}

/** «1 мин», «1,5 мин», «45 с». */
export function formatSpan(sec: number): string {
  if (sec < MIN) return `${sec} с`
  return `${String(Math.round((sec / MIN) * 10) / 10).replace('.', ',')} мин`
}

/** «бег 1 · шаг 1,5 × 8» — коротко, для карточки готового варианта (минуты). */
export function shortIntervals(c: RunIntervals): string {
  const m = (sec: number) => String(Math.round((sec / MIN) * 10) / 10).replace('.', ',')
  return `бег ${m(c.runSec)} · шаг ${m(c.walkSec)} × ${c.rounds}`
}

/** «Бег 1 мин / шаг 1,5 мин × 8». */
export function describeIntervals(c: RunIntervals): string {
  return `Бег ${formatSpan(c.runSec)} / шаг ${formatSpan(c.walkSec)} × ${c.rounds}`
}

export const RUN_PHASE_LABELS: Record<RunPhaseKind, string> = {
  warmup: 'Разминка',
  run: 'Бег',
  walk: 'Шаг',
}

/** Что сказать в начале фазы; null — конец интервалов. */
export function phaseCue(p: RunPhase | null, total: number): string {
  if (!p) return 'Интервалы выполнены! Пройдитесь шагом и завершайте'
  if (p.kind === 'warmup') return `Разминка: идите шагом ${spoken(p.durationSec)}`
  if (p.kind === 'walk') return `Шагом, ${spoken(p.durationSec)}`
  return `Бегом! ${p.round === total ? 'Последний повтор' : `Повтор ${p.round} из ${total}`}, ${spoken(p.durationSec)}`
}

/** Для голоса: «полторы минуты», «2 минуты», «45 секунд». */
function spoken(sec: number): string {
  if (sec < MIN) return `${sec} секунд`
  const m = sec / MIN
  if (m === 1) return 'минуту'
  if (m === 1.5) return 'полторы минуты'
  if (!Number.isInteger(m)) return `${String(m).replace('.', ',')} минуты`
  const n = m % 10
  const word =
    n === 1 && m % 100 !== 11
      ? 'минуту'
      : n >= 2 && n <= 4 && (m % 100 < 12 || m % 100 > 14)
        ? 'минуты'
        : 'минут'
  return `${m} ${word}`
}

/** Первые секунды пробежки: первую фазу ещё объявляем. */
export const START_GRACE_MS = 3000

/** Сигнал смены фазы, мс от начала времени в движении, — для будильников телефона. */
export interface PhaseCue {
  atMs: number
  kind: RunPhaseKind | 'finish'
  text: string
}

/**
 * Все смены фаз после `fromMs` (время в движении), включая конец интервалов.
 * В самом начале пробежки первая фаза объявляется сразу.
 */
export function upcomingCues(c: RunIntervals, fromMs: number): PhaseCue[] {
  const phases = runPhases(c)
  const cues: PhaseCue[] = []
  let at = 0
  for (let i = 0; i <= phases.length; i++) {
    const p = phases[i] ?? null
    if (at > fromMs || (at === 0 && fromMs < START_GRACE_MS)) {
      cues.push({
        atMs: Math.max(at, fromMs),
        kind: p?.kind ?? 'finish',
        text: phaseCue(p, c.rounds),
      })
    }
    if (p) at += p.durationSec * 1000
  }
  return cues
}
