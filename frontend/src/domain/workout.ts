// Правка активной тренировки без побочных эффектов: каждая функция возвращает новую тренировку.
// Экран тренировки применяет их к своему состоянию и сохраняет результат (автосохранение).

import { normalizeSupersets, supersetSpan, toggleLink } from './superset'
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
  if (!done) return next
  // Суперсет: отдых только когда отмечен весь круг — этот подход у всех упражнений группы
  const [a, b] = supersetSpan(next.entries, ei)
  const group = next.entries.slice(a, b + 1)
  if (a !== b && !group.every((e) => !e.sets[si] || e.sets[si].done)) return stopRest(next)
  const restSec = a !== b ? next.entries[b].restSec : entry.restSec
  if (restSec <= 0 || allDone(next)) return stopRest(next)
  return startRest(next, restSec, now)
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
  return { ...w, entries: normalizeSupersets([...w.entries, entry]) }
}

/** Объединить упражнение со следующим в суперсет или разъединить. */
export function toggleSuperset(w: Workout, ei: number): Workout {
  return { ...w, entries: toggleLink(w.entries, ei) }
}

/** Доля рабочего веса в лёгкий день. */
export const LIGHT_DAY_FACTOR = 0.8

/**
 * Лёгкий день: веса снижаются на 20 % и округляются вниз до шага блинов.
 * Повторы и число подходов те же — нагрузка падает, а техника и ритм остаются.
 */
export function lightenEntries(entries: WorkoutEntry[], step: number): WorkoutEntry[] {
  const down = (kg: number) => Math.floor((kg * LIGHT_DAY_FACTOR) / step + 1e-9) * step
  return entries.map((e) => ({
    ...e,
    sets: e.sets.map((s) => (s.weightKg > 0 ? { ...s, weightKg: down(s.weightKg) } : s)),
  }))
}

/**
 * Замена упражнения (занят тренажёр, болит сустав): план и отдых остаются прежними,
 * подходы берутся от нового упражнения, а их число — как было.
 */
export function replaceEntry(w: Workout, ei: number, entry: WorkoutEntry): Workout {
  return mapEntry(w, ei, (old) => {
    const fill = entry.sets[entry.sets.length - 1] ?? { weightKg: 0, reps: 10, done: false }
    const sets = Array.from({ length: old.sets.length }, (_, i) => ({
      ...(entry.sets[i] ?? fill),
      done: false,
    }))
    // суперсет остаётся, а заметка была про прежнее упражнение
    const replaced: WorkoutEntry = { ...old, exerciseId: entry.exerciseId, sets }
    delete replaced.note
    return replaced
  })
}

export function removeEntry(w: Workout, ei: number): Workout {
  return { ...w, entries: normalizeSupersets(w.entries.filter((_, i) => i !== ei)) }
}

export function moveEntry(w: Workout, ei: number, direction: -1 | 1): Workout {
  const target = ei + direction
  if (target < 0 || target >= w.entries.length) return w
  const entries = [...w.entries]
  ;[entries[ei], entries[target]] = [entries[target], entries[ei]]
  return { ...w, entries: normalizeSupersets(entries) }
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
  return min % 60 ? `${Math.floor(min / 60)} ч ${min % 60} мин` : `${min / 60} ч`
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

export interface ProgressionHint {
  /** Вес, который стоит попробовать сегодня. */
  weightKg: number
  /** Сколько невыполненных подходов ещё не на этом весе. */
  setsToChange: number
}

/**
 * Подсказка «пора прибавить вес» (ТЗ, v2): в прошлый раз сделаны все подходы плана
 * на верхней границе повторов или выше — предлагаем прибавить один шаг веса.
 * Только для упражнений с весом и планом; если все подходы уже на новом весе — подсказки нет.
 */
export function progressionHint(
  entry: WorkoutEntry,
  previous: WorkoutSet[] | null,
  type: ExerciseType,
  stepKg: number,
): ProgressionHint | null {
  const plan = entry.plan
  if (type !== 'weight' || !plan || !previous?.length || stepKg <= 0) return null
  if (previous.length < plan.sets || !previous.every((s) => s.reps >= plan.repsMax)) return null
  const lastWeight = Math.max(...previous.map((s) => s.weightKg))
  if (lastWeight <= 0) return null
  const weightKg = Math.round((lastWeight + stepKg) * 100) / 100
  const setsToChange = entry.sets.filter((s) => !s.done && s.weightKg < weightKg).length
  return setsToChange > 0 ? { weightKg, setsToChange } : null
}

/** Ставит вес всем невыполненным подходам упражнения. */
export function applyWeightToOpenSets(w: Workout, ei: number, weightKg: number): Workout {
  return mapEntry(w, ei, (e) => mapSets(e, (s) => (s.done ? s : { ...s, weightKg })))
}

/** Первый невыполненный подход тренировки — его подсвечиваем как следующий. */
/**
 * Следующий подход. В суперсете — по кругу: 1-й подход каждого упражнения группы,
 * потом 2-й и так далее; обычное упражнение — это группа из одного.
 */
export function nextOpenSet(w: Workout): { ei: number; si: number } | null {
  for (let ei = 0; ei < w.entries.length;) {
    const [a, b] = supersetSpan(w.entries, ei)
    const rounds = Math.max(...w.entries.slice(a, b + 1).map((e) => e.sets.length))
    for (let si = 0; si < rounds; si++) {
      for (let k = a; k <= b; k++) {
        const set = w.entries[k].sets[si]
        if (set && !set.done) return { ei: k, si }
      }
    }
    ei = b + 1
  }
  return null
}

/** Заметка к упражнению; пустая не хранится. */
export function setEntryNote(w: Workout, ei: number, note: string): Workout {
  return mapEntry(w, ei, (e) => {
    const next: WorkoutEntry = { ...e, note }
    if (!note.trim()) delete next.note
    return next
  })
}
