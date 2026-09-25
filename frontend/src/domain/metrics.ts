// Расчёты по подходам. Чистые функции: метрики не хранятся, а считаются из данных
// (архитектура, решение 3), поэтому правка старой тренировки сразу меняет статистику.

import type { ExerciseType, ID, ISODate, Workout, WorkoutSet } from './types'

/** Расчётный одноповторный максимум по формуле Эпли: w × (1 + r / 30). */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

/** Объём подхода, кг × повторения. */
export function setVolume(set: WorkoutSet): number {
  return Math.max(0, set.weightKg) * Math.max(0, set.reps)
}

export function doneSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => s.done)
}

/** Тоннаж тренировки: сумма weightKg × reps по выполненным подходам. */
export function workoutTonnage(workout: Workout): number {
  let total = 0
  for (const entry of workout.entries) {
    for (const set of doneSets(entry.sets)) total += setVolume(set)
  }
  return total
}

export function doneSetCount(workout: Workout): number {
  return workout.entries.reduce((n, e) => n + doneSets(e.sets).length, 0)
}

/** Тренировки, которые учитываются в статистике: завершённые и не удалённые. */
export function countable(workouts: Workout[]): Workout[] {
  return workouts.filter((w) => w.status === 'done' && w.deletedAt === null)
}

/** Лучшие показатели упражнения в одной тренировке. */
export interface SessionStats {
  workoutId: ID
  date: ISODate
  startedAt: number
  bestWeightKg: number
  best1RM: number
  bestSetVolume: number
  maxReps: number
  maxTimeSec: number
  sets: WorkoutSet[]
}

export function sessionStats(workout: Workout, exerciseId: ID): SessionStats | null {
  const sets = workout.entries
    .filter((e) => e.exerciseId === exerciseId)
    .flatMap((e) => doneSets(e.sets))
  if (!sets.length) return null
  return {
    workoutId: workout.id,
    date: workout.date,
    startedAt: workout.startedAt,
    bestWeightKg: Math.max(...sets.map((s) => s.weightKg)),
    best1RM: Math.max(...sets.map((s) => estimate1RM(s.weightKg, s.reps))),
    bestSetVolume: Math.max(...sets.map(setVolume)),
    maxReps: Math.max(...sets.map((s) => s.reps)),
    maxTimeSec: Math.max(...sets.map((s) => s.timeSec ?? 0)),
    sets,
  }
}

const byTime = (a: Workout, b: Workout) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt

/** История упражнения для графика: по одной точке на тренировку, от старых к новым. */
export function exerciseHistory(workouts: Workout[], exerciseId: ID): SessionStats[] {
  return countable(workouts)
    .sort(byTime)
    .map((w) => sessionStats(w, exerciseId))
    .filter((s): s is SessionStats => s !== null)
}

export interface PersonalRecords {
  maxWeightKg: number
  max1RM: number
  maxSetVolume: number
  maxReps: number
  maxTimeSec: number
}

export function personalRecords(history: SessionStats[]): PersonalRecords | null {
  if (!history.length) return null
  return {
    maxWeightKg: Math.max(...history.map((s) => s.bestWeightKg)),
    max1RM: Math.max(...history.map((s) => s.best1RM)),
    maxSetVolume: Math.max(...history.map((s) => s.bestSetVolume)),
    maxReps: Math.max(...history.map((s) => s.maxReps)),
    maxTimeSec: Math.max(...history.map((s) => s.maxTimeSec)),
  }
}

export type RecordKind = 'weight' | '1rm' | 'reps' | 'time'

export interface NewRecord {
  exerciseId: ID
  kind: RecordKind
  value: number
  previous: number
}

/** Минимальный прирост 1ПМ, который считается рекордом, а не погрешностью округления. */
const EPS = 0.01

/**
 * Рекорды тренировки относительно предыдущих. Первое выполнение упражнения рекордом
 * не считается: сравнивать не с чем. На упражнение выдаётся один, самый значимый рекорд:
 * для `weight` — вес, иначе 1ПМ; для `bodyweight` — повторения; для `time` — время.
 */
export function findNewRecords(
  workout: Workout,
  previousWorkouts: Workout[],
  getType: (exerciseId: ID) => ExerciseType,
): NewRecord[] {
  const previous = countable(previousWorkouts).filter((w) => w.id !== workout.id)
  const result: NewRecord[] = []
  for (const exerciseId of new Set(workout.entries.map((e) => e.exerciseId))) {
    const now = sessionStats(workout, exerciseId)
    const before = personalRecords(exerciseHistory(previous, exerciseId))
    if (!now || !before) continue
    const type = getType(exerciseId)
    if (type === 'weight') {
      if (now.bestWeightKg > before.maxWeightKg) {
        result.push({
          exerciseId,
          kind: 'weight',
          value: now.bestWeightKg,
          previous: before.maxWeightKg,
        })
      } else if (now.best1RM > before.max1RM + EPS) {
        result.push({ exerciseId, kind: '1rm', value: now.best1RM, previous: before.max1RM })
      }
    } else if (type === 'bodyweight') {
      if (now.maxReps > before.maxReps) {
        result.push({ exerciseId, kind: 'reps', value: now.maxReps, previous: before.maxReps })
      }
    } else if (now.maxTimeSec > before.maxTimeSec) {
      result.push({ exerciseId, kind: 'time', value: now.maxTimeSec, previous: before.maxTimeSec })
    }
  }
  return result
}

/** Локальная дата в формате YYYY-MM-DD. */
export function toISODate(d: Date): ISODate {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseISODate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Понедельник недели, в которую попадает дата. */
export function weekStart(d: Date): Date {
  const shift = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - shift)
}

export interface WeekTonnage {
  weekStart: ISODate
  tonnageKg: number
  workouts: number
}

/** Тоннаж и число тренировок по неделям (пн–вс): последние `weeks` недель, включая текущую. */
export function weeklyTonnage(workouts: Workout[], weeks: number, now: Date): WeekTonnage[] {
  const current = weekStart(now)
  const result: WeekTonnage[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * i)
    result.push({ weekStart: toISODate(start), tonnageKg: 0, workouts: 0 })
  }
  const index = new Map(result.map((w, i) => [w.weekStart, i]))
  for (const w of countable(workouts)) {
    const i = index.get(toISODate(weekStart(parseISODate(w.date))))
    if (i === undefined) continue
    result[i].tonnageKg += workoutTonnage(w)
    result[i].workouts += 1
  }
  return result
}
