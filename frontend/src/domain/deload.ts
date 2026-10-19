// Неделя разгрузки: после 4–6 недель подряд с ростом рабочих весов приложение предлагает
// неделю полегче — подходов на 40 % меньше, веса те же. Суставы и нервная система
// восстанавливаются, и после разгрузки рост идёт легче.

import { countable, doneSets, parseISODate, toISODate, weekStart, workingWeight } from './metrics'
import { addDays } from './nutrition'
import type { ID, ISODate, Workout, WorkoutEntry } from './types'

/** С какого числа недель подряд предлагать разгрузку. */
export const DELOAD_MIN_WEEKS = 4
/** С этого числа недель — настойчивее: «пора». */
export const DELOAD_DUE_WEEKS = 6
export const DELOAD_DAYS = 7
/** Доля подходов в разгрузку: −40 % объёма. */
export const DELOAD_SETS_FACTOR = 0.6
/** «Не сейчас» откладывает подсказку на столько дней. */
export const DELOAD_SNOOZE_DAYS = 7

/** Последняя (или идущая) неделя разгрузки: с какого по какое число включительно. */
export interface DeloadWeek {
  from: ISODate
  until: ISODate
}

export function deloadActive(deload: DeloadWeek | null, today: ISODate): boolean {
  return !!deload && deload.from <= today && today <= deload.until
}

export function startDeload(today: ISODate): DeloadWeek {
  return { from: today, until: addDays(today, DELOAD_DAYS - 1) }
}

/** Закончить раньше: разгрузка считается завершённой вчера. */
export function endDeload(deload: DeloadWeek, today: ISODate): DeloadWeek {
  const until = addDays(today, -1)
  return { from: deload.from <= until ? deload.from : until, until }
}

export function deloadSets(sets: number): number {
  return Math.max(1, Math.round(sets * DELOAD_SETS_FACTOR))
}

/** Разгрузочная тренировка: первые ~60 % подходов каждого упражнения, веса и повторы те же. */
export function deloadEntries(entries: WorkoutEntry[]): WorkoutEntry[] {
  return entries.map((e) => {
    const count = deloadSets(e.sets.length)
    return {
      ...e,
      sets: e.sets.slice(0, count),
      ...(e.plan ? { plan: { ...e.plan, sets: count } } : {}),
    }
  })
}

export interface TrainingBlock {
  /** Сколько недель подряд были тренировки (после прошлой разгрузки). */
  weeks: number
  /** У скольких упражнений рабочий вес вырос от начала блока к концу и у скольких упал. */
  rising: number
  falling: number
}

/**
 * Блок тренировок: недели подряд с тренировками, считая от текущей (если на этой неделе
 * ещё не тренировались — от прошлой) назад до пропущенной недели или прошлой разгрузки.
 */
export function trainingBlock(
  workouts: Workout[],
  since: ISODate | null,
  today: ISODate,
): TrainingBlock {
  const done = countable(workouts).filter((w) => !since || w.date > since)
  const byWeek = new Map<ISODate, Workout[]>()
  for (const w of done) {
    const key = toISODate(weekStart(parseISODate(w.date)))
    byWeek.set(key, [...(byWeek.get(key) ?? []), w])
  }

  let week = toISODate(weekStart(parseISODate(today)))
  if (!byWeek.has(week)) week = addDays(week, -7)
  const block: Workout[] = []
  let weeks = 0
  while (byWeek.has(week)) {
    block.push(...byWeek.get(week)!)
    weeks++
    week = addDays(week, -7)
  }

  // Рабочий вес каждого упражнения по тренировкам блока, от старых к новым
  block.sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
  const series = new Map<ID, number[]>()
  for (const w of block) {
    for (const id of new Set(w.entries.map((e) => e.exerciseId))) {
      const sets = w.entries.filter((e) => e.exerciseId === id).flatMap((e) => doneSets(e.sets))
      const kg = workingWeight(sets)
      if (kg > 0) series.set(id, [...(series.get(id) ?? []), kg])
    }
  }
  let rising = 0
  let falling = 0
  for (const kgs of series.values()) {
    if (kgs.length < 2) continue
    if (kgs[kgs.length - 1] > kgs[0]) rising++
    else if (kgs[kgs.length - 1] < kgs[0]) falling++
  }
  return { weeks, rising, falling }
}

export type DeloadAdvice = { level: 'maybe' | 'due'; weeks: number } | null

/** Подсказать ли разгрузку: 4+ недели подряд, и веса больше растут, чем падают. */
export function deloadAdvice(block: TrainingBlock): DeloadAdvice {
  if (block.weeks < DELOAD_MIN_WEEKS || block.rising === 0 || block.rising <= block.falling) {
    return null
  }
  return { level: block.weeks >= DELOAD_DUE_WEEKS ? 'due' : 'maybe', weeks: block.weeks }
}
