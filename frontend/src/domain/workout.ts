// Правка активной тренировки без побочных эффектов: каждая функция возвращает новую тренировку.
// Экран тренировки применяет их к своему состоянию и сохраняет результат (автосохранение).

import type { ExerciseType, Timestamp, Workout, WorkoutEntry, WorkoutSet } from './types'
import { formatDecimal } from './number'

export const SET_LIMITS = {
  weightKg: { min: 0, max: 1000 },
  reps: { min: 0, max: 200 },
  timeSec: { min: 0, max: 3600 },
} as const

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function mapEntry(w: Workout, ei: number, fn: (e: WorkoutEntry) => WorkoutEntry): Workout {
  return { ...w, entries: w.entries.map((e, i) => (i === ei ? fn(e) : e)) }
}

function mapSets(e: WorkoutEntry, fn: (s: WorkoutSet, i: number) => WorkoutSet): WorkoutEntry {
  return { ...e, sets: e.sets.map(fn) }
}

type SetField = 'weightKg' | 'reps' | 'timeSec'

/**
 * Меняет вес, повторения или время подхода. Следующие невыполненные подходы
 * с тем же старым значением меняются вместе с ним: поменяли вес в первом подходе —
 * остальные подходы подтянулись, а уже отдельно исправленные не трогаются.
 */
export function setValue(
  w: Workout,
  ei: number,
  si: number,
  field: SetField,
  value: number,
): Workout {
  const limits =
    field === 'weightKg'
      ? SET_LIMITS.weightKg
      : field === 'reps'
        ? SET_LIMITS.reps
        : SET_LIMITS.timeSec
  const next = clamp(
    field === 'weightKg' ? Math.round(value * 100) / 100 : Math.round(value),
    limits.min,
    limits.max,
  )
  return mapEntry(w, ei, (e) => {
    const old = e.sets[si]?.[field] ?? 0
    return mapSets(e, (s, i) => {
      if (i === si) return { ...s, [field]: next }
      if (i > si && !s.done && (s[field] ?? 0) === old) return { ...s, [field]: next }
      return s
    })
  })
}

/**
 * Отмечает подход выполненным или снимает отметку. Отметка запускает отдых
 * с длительностью из плана упражнения, снятие отметки отдых не трогает.
 */
export function toggleDone(w: Workout, ei: number, si: number, now: Timestamp): Workout {
  const entry = w.entries[ei]
  const done = !entry.sets[si].done
  const next = mapEntry(w, ei, (e) => mapSets(e, (s, i) => (i === si ? { ...s, done } : s)))
  if (!done || entry.restSec <= 0 || allDone(next)) return done ? stopRest(next) : next
  return startRest(next, entry.restSec, now)
}

/** Отметка подхода без запуска отдыха — для правки прошлой тренировки. */
export function toggleSetOnly(w: Workout, ei: number, si: number): Workout {
  return mapEntry(w, ei, (e) => mapSets(e, (s, i) => (i === si ? { ...s, done: !s.done } : s)))
}

export function allDone(w: Workout): boolean {
  return w.entries.length > 0 && w.entries.every((e) => e.sets.every((s) => s.done))
}

export function startRest(w: Workout, sec: number, now: Timestamp): Workout {
  return { ...w, restEndsAt: now + sec * 1000, restTotalSec: sec }
}

export function stopRest(w: Workout): Workout {
  return { ...w, restEndsAt: null }
}

/** Прибавить или убавить отдых; меньше нуля не бывает. */
export function adjustRest(w: Workout, deltaSec: number, now: Timestamp): Workout {
  if (!w.restEndsAt) return w
  const ends = Math.max(now, w.restEndsAt + deltaSec * 1000)
  return { ...w, restEndsAt: ends, restTotalSec: Math.max(1, (w.restTotalSec ?? 0) + deltaSec) }
}

/**
 * Новый подход копирует последний: чаще всего следующий подход такой же.
 * При правке прошлой тренировки (`done` = true) добавленный подход сразу считается выполненным.
 */
export function addSet(w: Workout, ei: number, done = false): Workout {
  return mapEntry(w, ei, (e) => {
    const last = e.sets[e.sets.length - 1]
    const set: WorkoutSet = last ? { ...last, done } : { weightKg: 0, reps: 10, done }
    return { ...e, sets: [...e.sets, set] }
  })
}

/** Убирает последний подход. Хотя бы один подход у упражнения остаётся. */
export function removeLastSet(w: Workout, ei: number): Workout {
  return mapEntry(w, ei, (e) => (e.sets.length <= 1 ? e : { ...e, sets: e.sets.slice(0, -1) }))
}

export function addEntry(w: Workout, entry: WorkoutEntry): Workout {
  return { ...w, entries: [...w.entries, entry] }
}

export function removeEntry(w: Workout, ei: number): Workout {
  return { ...w, entries: w.entries.filter((_, i) => i !== ei) }
}

export function moveEntry(w: Workout, ei: number, direction: -1 | 1): Workout {
  const target = ei + direction
  if (target < 0 || target >= w.entries.length) return w
  const entries = [...w.entries]
  ;[entries[ei], entries[target]] = [entries[target], entries[ei]]
  return { ...w, entries }
}

export function countSets(w: Workout): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const e of w.entries) {
    total += e.sets.length
    done += e.sets.filter((s) => s.done).length
  }
  return { done, total }
}

/** «60 × 10», «+10 × 8», «45 с», «12» для собственного веса без добавки. */
export function formatSet(set: WorkoutSet, type: ExerciseType): string {
  if (type === 'time') return `${set.timeSec ?? 0} с`
  if (type === 'bodyweight')
    return set.weightKg > 0 ? `+${formatDecimal(set.weightKg)} × ${set.reps}` : `${set.reps}`
  return `${formatDecimal(set.weightKg)} × ${set.reps}`
}

/** Секунды → «1:05», «12:40», «1:02:05». */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Длительность для сводки: «48 мин», «1 ч 12 мин». */
export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 60) return `${min} мин`
  return `${Math.floor(min / 60)} ч ${min % 60} мин`
}

/** Оставляет только выполненные подходы и упражнения, в которых они есть. */
export function keepDone(w: Workout): Workout {
  const entries = w.entries
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0)
  return { ...w, entries, restEndsAt: null }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Переносит тренировку на другую дату. Время начала и конца сдвигаются на столько же дней,
 * чтобы длительность и порядок тренировок в истории остались верными.
 */
export function changeDate(w: Workout, date: string): Workout {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date === w.date) return w
  const [y1, m1, d1] = w.date.split('-').map(Number)
  const [y2, m2, d2] = date.split('-').map(Number)
  const shift = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS) * DAY_MS
  return {
    ...w,
    date,
    startedAt: w.startedAt + shift,
    finishedAt: w.finishedAt === null ? null : w.finishedAt + shift,
  }
}
