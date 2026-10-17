// Расчёты питания: суммы за день, пересчёт порции по весу, итоги по дням для графика.

import { parseISODate, toISODate } from './metrics'
import type { Activity, BodyProfile, ISODate, Meal, NutritionGoal, Nutrients } from './types'

export const NUTRIENT_KEYS = ['calories', 'protein', 'fat', 'carbs'] as const

export const ZERO_NUTRIENTS: Nutrients = { calories: 0, protein: 0, fat: 0, carbs: 0 }

/** Калории — до целых, белки, жиры, углеводы — до десятых. */
export function roundNutrients(n: Nutrients): Nutrients {
  return {
    calories: Math.round(n.calories),
    protein: Math.round(n.protein * 10) / 10,
    fat: Math.round(n.fat * 10) / 10,
    carbs: Math.round(n.carbs * 10) / 10,
  }
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const total = { ...ZERO_NUTRIENTS }
  for (const n of list) for (const k of NUTRIENT_KEYS) total[k] += n[k]
  return roundNutrients(total)
}

/** Значения порции другого веса: всё пропорционально граммам. Без веса пересчитать нельзя. */
export function scaleNutrients(n: Nutrients, fromGrams: number | null, toGrams: number): Nutrients {
  if (!fromGrams || fromGrams <= 0) return roundNutrients(n)
  const k = toGrams / fromGrams
  return roundNutrients({
    calories: n.calories * k,
    protein: n.protein * k,
    fat: n.fat * k,
    carbs: n.carbs * k,
  })
}

/** Калории из белков, жиров и углеводов: 4, 9 и 4 ккал на грамм. */
export function caloriesFromMacros(n: Pick<Nutrients, 'protein' | 'fat' | 'carbs'>): number {
  return Math.round(n.protein * 4 + n.fat * 9 + n.carbs * 4)
}

/** Сдвиг даты на `days` дней. */
export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date)
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** Итоги за каждый из `days` дней по `to` включительно, от старых к новым. Пустые дни — нули. */
export function dailyTotals(
  meals: Meal[],
  to: ISODate,
  days: number,
): { date: ISODate; total: Nutrients }[] {
  const byDate = new Map<ISODate, Meal[]>()
  for (const m of meals) byDate.set(m.date, [...(byDate.get(m.date) ?? []), m])
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(to, i - days + 1)
    return { date, total: sumNutrients(byDate.get(date) ?? []) }
  })
}

/** Множитель к базовому обмену по уровню активности. */
export const ACTIVITY_FACTORS: Record<Activity, number> = {
  none: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  extreme: 1.9,
}

/** Изменение веса в неделю для цели: худеем на 0,5 кг, набираем на 0,25 кг. */
const GOAL_KG_PER_WEEK: Record<NutritionGoal, number> = { lose: -0.5, maintain: 0, gain: 0.25 }

/** Килокалорий в килограмме жира. */
const KCAL_PER_KG = 7700

/** Белок на килограмм веса: на сушке и наборе больше, чтобы сохранять и строить мышцы. */
const PROTEIN_PER_KG: Record<NutritionGoal, number> = { lose: 1.8, maintain: 1.6, gain: 1.8 }

export interface PlanEstimate extends Nutrients {
  /** Базовый обмен — расход в покое. */
  bmr: number
  /** Расход с учётом активности — столько нужно, чтобы вес стоял. */
  maintenance: number
}

/**
 * Дневная норма по формуле Миффлина — Сан Жеора с поправкой на активность и цель.
 * Калории — до десятков; жиры — 30 % калорий; углеводы — остаток.
 */
export function estimatePlan(p: BodyProfile, weightKg: number): PlanEstimate {
  const bmr = 10 * weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161)
  const maintenance = bmr * ACTIVITY_FACTORS[p.activity]
  const delta = (GOAL_KG_PER_WEEK[p.goal] * KCAL_PER_KG) / 7
  const floor = p.sex === 'male' ? 1500 : 1200
  const calories = Math.max(Math.round((maintenance + delta) / 10) * 10, floor)
  const protein = Math.round(weightKg * PROTEIN_PER_KG[p.goal])
  const fat = Math.round((calories * 0.3) / 9)
  const carbs = Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 0)
  return {
    calories,
    protein,
    fat,
    carbs,
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
  }
}
