import { newId } from '../../domain/id'
import { roundNutrients } from '../../domain/nutrition'
import type { ID, ISODate, Meal, Nutrients } from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'

export const MEAL_LIMITS = {
  name: 80,
  grams: { min: 1, max: 5000 },
  calories: { min: 0, max: 10000 },
  macro: { min: 0, max: 1000 },
} as const

export interface MealInput extends Nutrients {
  name: string
  grams: number | null
}

const inRange = (v: number, { min, max }: { min: number; max: number }) =>
  Number.isFinite(v) && v >= min && v <= max

/** Проверяет ввод и приводит его к виду для хранения. Текст ошибки показывается как есть. */
function normalize(input: MealInput): MealInput {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('Введите название')
  if (name.length > MEAL_LIMITS.name) {
    throw new Error(`Название — не длиннее ${MEAL_LIMITS.name} символов`)
  }
  if (input.grams !== null && !inRange(input.grams, MEAL_LIMITS.grams)) {
    throw new Error(`Вес порции — от ${MEAL_LIMITS.grams.min} до ${MEAL_LIMITS.grams.max} г`)
  }
  if (!inRange(input.calories, MEAL_LIMITS.calories)) {
    throw new Error(`Калории — от 0 до ${MEAL_LIMITS.calories.max}`)
  }
  for (const k of ['protein', 'fat', 'carbs'] as const) {
    if (!inRange(input[k], MEAL_LIMITS.macro)) {
      throw new Error(`Белки, жиры и углеводы — от 0 до ${MEAL_LIMITS.macro.max} г`)
    }
  }
  return {
    name,
    grams: input.grams === null ? null : Math.round(input.grams),
    ...roundNutrients(input),
  }
}

export function mealsRepo(db: FitnessDB, clock: Clock) {
  const alive = (rows: Meal[]) =>
    rows.filter((m) => m.deletedAt === null).sort((a, b) => a.createdAt - b.createdAt)

  return {
    /** Приёмы пищи за день в порядке добавления. */
    async listDay(date: ISODate): Promise<Meal[]> {
      return alive(await db.meals.where('date').equals(date).toArray())
    },

    /** Приёмы пищи с `from` по `to` включительно. */
    async listRange(from: ISODate, to: ISODate): Promise<Meal[]> {
      return alive(await db.meals.where('date').between(from, to, true, true).toArray())
    },

    /**
     * Недавние блюда без повторов по названию, от новых к старым — для быстрого повтора.
     * Берётся последний вариант каждого блюда: с его весом и значениями.
     */
    async recent(limit = 12): Promise<Meal[]> {
      const rows = await db.meals.toArray()
      rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      const seen = new Set<string>()
      const result: Meal[] = []
      for (const m of rows) {
        const key = m.name.toLowerCase()
        if (m.deletedAt !== null || seen.has(key)) continue
        seen.add(key)
        result.push(m)
        if (result.length === limit) break
      }
      return result
    },

    async add(input: MealInput, date: ISODate): Promise<Meal> {
      const now = clock()
      const meal: Meal = {
        id: newId(),
        date,
        ...normalize(input),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await db.meals.add(meal)
      return meal
    },

    async update(id: ID, input: MealInput): Promise<void> {
      await db.meals.update(id, { ...normalize(input), updatedAt: clock() })
    },

    async remove(id: ID): Promise<void> {
      await db.meals.update(id, { deletedAt: clock(), updatedAt: clock() })
    },
  }
}
