import type { DayTracker, ISODate } from './types'

/** Один стакан воды, мл — шаг кнопок ±. */
export const GLASS_ML = 250
export const WATER_MAX_ML = 10000
export const SLEEP_MAX_MIN = 24 * 60
/** Цель сна, минут. */
export const SLEEP_GOAL_MIN = 8 * 60

/** Норма воды: 30 мл на кг веса, округлённо до стакана; без веса — 2 л. */
export function waterGoalMl(weightKg: number | null): number {
  if (!weightKg) return 2000
  return Math.round((weightKg * 30) / GLASS_ML) * GLASS_ML
}

/** «7 ч 30 мин», «45 мин», «8 ч». */
export function formatSleep(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} мин`
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

/** Новая запись дня: значения ограничены, пустой день из словаря убирается. */
export function withDay(
  all: Record<ISODate, DayTracker>,
  date: ISODate,
  patch: DayTracker,
): Record<ISODate, DayTracker> {
  const day = { ...all[date], ...patch }
  if (day.waterMl !== undefined) day.waterMl = clamp(day.waterMl, WATER_MAX_ML)
  if (day.sleepMin !== undefined) day.sleepMin = clamp(day.sleepMin, SLEEP_MAX_MIN)
  const next = { ...all }
  if (!day.waterMl && !day.sleepMin) delete next[date]
  else next[date] = day
  return next
}

const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)))
