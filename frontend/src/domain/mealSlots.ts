import type { Meal, MealSlot } from './types'

export const MEAL_SLOTS: { value: MealSlot; label: string }[] = [
  { value: 'breakfast', label: 'Завтрак' },
  { value: 'snack', label: 'Перекус' },
  { value: 'lunch', label: 'Обед' },
  { value: 'dinner', label: 'Ужин' },
]

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = Object.fromEntries(
  MEAL_SLOTS.map((s) => [s.value, s.label]),
) as Record<MealSlot, string>

/** Приём пищи по времени: до 11 — завтрак, до 15 — обед, до 18 — перекус, позже — ужин. */
export function slotByTime(at: number): MealSlot {
  const hour = new Date(at).getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 18) return 'snack'
  return 'dinner'
}

/** Приём пищи записи: выбранный или, у старых записей, по времени добавления. */
export const mealSlot = (m: Pick<Meal, 'slot' | 'createdAt'>): MealSlot =>
  m.slot ?? slotByTime(m.createdAt)

export const isMealSlot = (v: unknown): v is MealSlot => MEAL_SLOTS.some((s) => s.value === v)
