// Подсказки к плану питания: пересчитать, если вес ушёл с расчёта, и поправить калории
// по реальному темпу веса — формула даёт оценку, а весы показывают, как на самом деле.

import { parseISODate } from './metrics'
import {
  addDays,
  caloriesFloor,
  estimatePlan,
  GOAL_KG_PER_WEEK,
  KCAL_PER_KG,
  splitMacros,
} from './nutrition'
import type { BodyProfile, BodyWeight, ISODate, Nutrients, PlanBasis } from './types'

/** С какого изменения веса предлагать пересчёт, кг. */
export const RECALC_AFTER_KG = 2
/** За сколько дней смотреть темп веса. */
const TREND_DAYS = 21
/** Темп считается, если записи растянуты хотя бы на столько дней… */
const TREND_MIN_SPAN = 14
/** …и их не меньше этого. */
const TREND_MIN_POINTS = 4
/** Расхождение с целью, кг в неделю, ниже которого план не трогаем. */
const TREND_TOLERANCE = 0.2
/** Поправка за раз, ккал: не больше, чтобы не качать план из стороны в сторону. */
const MAX_STEP = 300
/** «Не сейчас» откладывает подсказку на неделю. */
export const SNOOZE_DAYS = 7

export type PlanAdvice =
  | { kind: 'recalc'; fromKg: number; toKg: number; next: Nutrients }
  | { kind: 'adjust'; ratePerWeek: number; targetPerWeek: number; days: number; next: Nutrients }

const dayIndex = (d: ISODate) => Math.round(parseISODate(d).getTime() / 86_400_000)

/** Темп веса, кг в неделю, — наклон прямой по записям (метод наименьших квадратов). */
export function weightTrend(rows: Pick<BodyWeight, 'date' | 'weightKg'>[]): number {
  const xs = rows.map((r) => dayIndex(r.date))
  const ys = rows.map((r) => r.weightKg)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  return den ? (num / den) * 7 : 0
}

/** Те же белки, а жиры и углеводы — под новые калории; план без Б/Ж/У так и остаётся без них. */
function withCalories(plan: Nutrients, calories: number): Nutrients {
  if (!plan.protein) return { ...plan, calories }
  return { calories, protein: plan.protein, ...splitMacros(calories, plan.protein) }
}

/**
 * Что посоветовать к плану сегодня; null — всё в порядке или подсказку отложили.
 * Сначала пересчёт (вес ушёл на 2 кг и больше с расчёта), потом поправка по темпу за 3 недели.
 * `weights` — по дате, от старых к новым.
 */
export function planAdvice({
  plan,
  basis,
  profile,
  weights,
  today,
}: {
  plan: Nutrients | null
  basis: PlanBasis | null
  profile: BodyProfile | null
  weights: Pick<BodyWeight, 'date' | 'weightKg'>[]
  today: ISODate
}): PlanAdvice | null {
  if (!plan || !profile || weights.length === 0) return null
  if (basis?.snoozedUntil && basis.snoozedUntil > today) return null
  const last = weights.at(-1)!.weightKg

  if (basis?.weightKg && Math.abs(last - basis.weightKg) >= RECALC_AFTER_KG) {
    const { calories, protein, fat, carbs } = estimatePlan(profile, last)
    return {
      kind: 'recalc',
      fromKg: basis.weightKg,
      toKg: last,
      next: { calories, protein, fat, carbs },
    }
  }

  // темп — только по записям после того, как план задан: раньше человек ел по-другому
  const from = addDays(today, -TREND_DAYS)
  const start = basis?.setAt && basis.setAt > from ? basis.setAt : from
  const rows = weights.filter((w) => w.date >= start && w.date <= today)
  if (rows.length < TREND_MIN_POINTS) return null
  const days = dayIndex(rows.at(-1)!.date) - dayIndex(rows[0].date)
  if (days < TREND_MIN_SPAN) return null

  const rate = weightTrend(rows)
  const target = GOAL_KG_PER_WEEK[profile.goal]
  const diff = rate - target
  if (Math.abs(diff) < TREND_TOLERANCE) return null
  // лишние 0,1 кг в неделю — это 110 ккал в день
  const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, (-diff * KCAL_PER_KG) / 7))
  const calories = Math.max(
    Math.round((plan.calories + Math.round(step / 50) * 50) / 10) * 10,
    caloriesFloor(profile.sex),
  )
  if (calories === plan.calories) return null
  return {
    kind: 'adjust',
    ratePerWeek: Math.round(rate * 100) / 100,
    targetPerWeek: target,
    days,
    next: withCalories(plan, calories),
  }
}
