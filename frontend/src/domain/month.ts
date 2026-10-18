// «Итоги месяца»: тренировки, тоннаж, подходы, время, рекорды и пробежки за календарный месяц.

import {
  countable,
  doneSetCount,
  doneSets,
  findNewRecords,
  toISODate,
  workoutTonnage,
  type NewRecord,
} from './metrics'
import type { Run } from './run'
import type { ExerciseType, ID, Workout } from './types'

/** Месяц как «2026-10». */
export type YearMonth = string

export interface MonthSummary {
  month: YearMonth
  workouts: number
  /** Дней с тренировкой. */
  days: number
  tonnageKg: number
  sets: number
  /** Время в зале; ручные тренировки без длительности не учитываются. */
  minutes: number
  /** Рекорды месяца: по одному на упражнение, «было» — до начала месяца. */
  records: NewRecord[]
  /** Упражнение, в котором больше всего подходов. */
  top: { exerciseId: ID; sets: number } | null
  runs: number
  runKm: number
  /** Тренировок в прошлом месяце — для «+3 к сентябрю». */
  prevWorkouts: number
}

export const yearMonth = (d: Date): YearMonth => toISODate(d).slice(0, 7)

/** Соседний месяц: shift = −1 — прошлый. */
export function shiftMonth(month: YearMonth, shift: number): YearMonth {
  const [y, m] = month.split('-').map(Number)
  return yearMonth(new Date(y, m - 1 + shift, 1))
}

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
]
const MONTHS_DAT = [
  'январю',
  'февралю',
  'марту',
  'апрелю',
  'маю',
  'июню',
  'июлю',
  'августу',
  'сентябрю',
  'октябрю',
  'ноябрю',
  'декабрю',
]

/** «Октябрь 2026». */
export function monthTitle(month: YearMonth): string {
  const [y, m] = month.split('-').map(Number)
  const name = MONTHS[m - 1]
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`
}

/** «сентябрю» — для «+2 к сентябрю». */
export const monthDative = (month: YearMonth) => MONTHS_DAT[Number(month.slice(5, 7)) - 1]

export function monthSummary(
  all: Workout[],
  runs: Run[],
  month: YearMonth,
  getType: (exerciseId: ID) => ExerciseType,
): MonthSummary {
  const list = countable(all).sort((a, b) => a.startedAt - b.startedAt)
  const inMonth = list.filter((w) => w.date.startsWith(month))
  const prev = shiftMonth(month, -1)

  // рекорды по порядку тренировок; «было» берётся из первого рекорда месяца
  const records = new Map<ID, NewRecord>()
  for (const w of inMonth) {
    const before = list.filter((x) => x.startedAt < w.startedAt)
    for (const r of findNewRecords(w, before, getType)) {
      const first = records.get(r.exerciseId)
      records.set(r.exerciseId, first?.kind === r.kind ? { ...r, previous: first.previous } : r)
    }
  }

  const setsBy = new Map<ID, number>()
  for (const w of inMonth)
    for (const e of w.entries)
      setsBy.set(e.exerciseId, (setsBy.get(e.exerciseId) ?? 0) + doneSets(e.sets).length)
  let top: MonthSummary['top'] = null
  for (const [exerciseId, sets] of setsBy) if (sets > (top?.sets ?? 0)) top = { exerciseId, sets }

  const monthRuns = runs.filter(
    (r) =>
      r.status === 'done' && r.deletedAt === null && yearMonth(new Date(r.startedAt)) === month,
  )

  return {
    month,
    workouts: inMonth.length,
    days: new Set(inMonth.map((w) => w.date)).size,
    tonnageKg: inMonth.reduce((s, w) => s + workoutTonnage(w), 0),
    sets: inMonth.reduce((s, w) => s + doneSetCount(w), 0),
    minutes: Math.round(
      inMonth
        .filter((w) => !w.manual && w.finishedAt)
        .reduce((s, w) => s + (w.finishedAt! - w.startedAt), 0) / 60000,
    ),
    records: [...records.values()],
    top,
    runs: monthRuns.length,
    runKm: monthRuns.reduce((s, r) => s + r.distanceM, 0) / 1000,
    prevWorkouts: list.filter((w) => w.date.startsWith(prev)).length,
  }
}
