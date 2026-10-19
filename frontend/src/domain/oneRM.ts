// Калькулятор 1ПМ: максимум на один повтор по подходу и таблица рабочих весов от него.
// Формула та же, что у рекордов (estimate1RM, Эпли), чтобы цифры везде совпадали.

import { estimate1RM } from './metrics'
import type { WorkoutSet } from './types'

/** Проценты таблицы: от максимума до лёгкой разминки. */
export const ONE_RM_PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] as const

/** Формула честна при 1–10 повторах; дальше она завышает максимум. */
export const ONE_RM_RELIABLE_REPS = 10

export type OneRMZone = 'max' | 'strength' | 'mass' | 'light'

export const ONE_RM_ZONE_LABELS: Record<OneRMZone, string> = {
  max: 'Максимум',
  strength: 'Сила',
  mass: 'Масса',
  light: 'Техника, разминка',
}

export interface OneRMRow {
  percent: number
  /** Вес, округлённый до шага блинов. */
  weightKg: number
  /** Сколько примерно повторов выходит с этим весом до отказа. */
  reps: number
  zone: OneRMZone
}

function zoneOf(percent: number): OneRMZone {
  if (percent >= 100) return 'max'
  if (percent >= 85) return 'strength'
  if (percent >= 65) return 'mass'
  return 'light'
}

/** Округление до шага веса; шаг 0 — без округления, до десятых. */
function roundTo(kg: number, step: number): number {
  if (step <= 0) return Math.round(kg * 10) / 10
  return Math.round(Math.round(kg / step) * step * 1000) / 1000
}

/** Повторы до отказа при доле от максимума — обратная формула Эпли: r = 30 × (1/p − 1). */
export function repsAtPercent(percent: number): number {
  if (percent >= 100) return 1
  return Math.max(1, Math.round(30 * (100 / percent - 1)))
}

export function oneRMTable(oneRMKg: number, step: number): OneRMRow[] {
  if (oneRMKg <= 0) return []
  return ONE_RM_PERCENTS.map((percent) => ({
    percent,
    weightKg: roundTo((oneRMKg * percent) / 100, step),
    reps: repsAtPercent(percent),
    zone: zoneOf(percent),
  }))
}

/** Подход с самым большим расчётным максимумом — с него калькулятор и начинает. */
export function best1RMSet(sets: WorkoutSet[]): WorkoutSet | null {
  let best: WorkoutSet | null = null
  let bestValue = 0
  for (const s of sets) {
    const value = estimate1RM(s.weightKg, s.reps)
    if (value > bestValue) {
      best = s
      bestValue = value
    }
  }
  return best
}
