// Правка программы без побочных эффектов: каждая функция возвращает новую программу.
// Экран редактора собирает изменения через эти функции и сохраняет результат целиком.

import { formatDecimal } from './number'
import type { Exercise, ExerciseType, PlanItem, Program, ProgramDay } from './types'
import { newId } from './id'

const DAY_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const PLAN_LIMITS = {
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  timeSec: { min: 5, max: 3600 },
  weightKg: { min: 0, max: 1000 },
  restSec: { min: 0, max: 600 },
} as const

export function newDay(index: number): ProgramDay {
  return { id: newId(), name: `День ${DAY_LETTERS[index] ?? index + 1}`, items: [] }
}

/** Упражнение в плане со значениями по умолчанию: 3 подхода по 8–12 или 30–60 с. */
export function newPlanItem(exercise: Pick<Exercise, 'id' | 'type'>): PlanItem {
  const timed = exercise.type === 'time'
  return {
    exerciseId: exercise.id,
    sets: 3,
    repsMin: timed ? 30 : 8,
    repsMax: timed ? 60 : 12,
    weightKg: 0,
    restSec: 90,
  }
}

/** Переставляет элемент на соседнее место. За границы не выходит. */
export function move<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Меняет поля упражнения в плане и держит значения в допустимых пределах.
 * Если «от» стало больше «до» (или наоборот), вторая граница подтягивается.
 */
export function updatePlanItem(
  item: PlanItem,
  patch: Partial<PlanItem>,
  type: ExerciseType,
): PlanItem {
  const reps = type === 'time' ? PLAN_LIMITS.timeSec : PLAN_LIMITS.reps
  const next = { ...item, ...patch }
  next.sets = clamp(Math.round(next.sets), PLAN_LIMITS.sets.min, PLAN_LIMITS.sets.max)
  next.repsMin = clamp(Math.round(next.repsMin), reps.min, reps.max)
  next.repsMax = clamp(Math.round(next.repsMax), reps.min, reps.max)
  if (next.repsMin > next.repsMax) {
    if (patch.repsMin !== undefined) next.repsMax = next.repsMin
    else next.repsMin = next.repsMax
  }
  next.weightKg =
    type === 'time' ? 0 : clamp(next.weightKg, PLAN_LIMITS.weightKg.min, PLAN_LIMITS.weightKg.max)
  next.restSec = clamp(Math.round(next.restSec), PLAN_LIMITS.restSec.min, PLAN_LIMITS.restSec.max)
  return next
}

export function mapDay(
  program: Program,
  dayId: string,
  fn: (day: ProgramDay) => ProgramDay,
): Program {
  return { ...program, days: program.days.map((d) => (d.id === dayId ? fn(d) : d)) }
}

export function addDay(program: Program): Program {
  return { ...program, days: [...program.days, newDay(program.days.length)] }
}

/** Копия дня встаёт сразу после оригинала. */
export function copyDay(program: Program, dayId: string): Program {
  const i = program.days.findIndex((d) => d.id === dayId)
  if (i < 0) return program
  const source = program.days[i]
  const copy: ProgramDay = {
    id: newId(),
    name: `${source.name} (копия)`,
    items: source.items.map((it) => ({ ...it })),
  }
  const days = [...program.days]
  days.splice(i + 1, 0, copy)
  return { ...program, days }
}

/** Последний день удалить нельзя: в программе всегда есть хотя бы один. */
export function removeDay(program: Program, dayId: string): Program {
  if (program.days.length <= 1) return program
  return { ...program, days: program.days.filter((d) => d.id !== dayId) }
}

export function moveDay(program: Program, dayId: string, direction: -1 | 1): Program {
  return {
    ...program,
    days: move(
      program.days,
      program.days.findIndex((d) => d.id === dayId),
      direction,
    ),
  }
}

/** «3 × 8–12 · 60 кг · отдых 90 с», для упражнений на время — «3 × 30–60 с». */
export function formatPlan(item: PlanItem, type: ExerciseType): string {
  const reps = item.repsMin === item.repsMax ? `${item.repsMax}` : `${item.repsMin}–${item.repsMax}`
  const parts = [`${item.sets} × ${reps}${type === 'time' ? ' с' : ''}`]
  if (type === 'weight' && item.weightKg > 0) parts.push(`${formatDecimal(item.weightKg)} кг`)
  if (type === 'bodyweight' && item.weightKg > 0) parts.push(`+${formatDecimal(item.weightKg)} кг`)
  if (item.restSec > 0) parts.push(`отдых ${formatRest(item.restSec)}`)
  return parts.join(' · ')
}

/** 90 → «1:30», 45 → «45 с». */
export function formatRest(sec: number): string {
  if (sec < 60) return `${sec} с`
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
