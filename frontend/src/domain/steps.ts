import { addDays } from './nutrition'
import type { ISODate } from './types'

/** «Всё время»: дни до первого шага не показываем — иначе год нулей. */
export function trimLeadingZeros<T extends { steps: number }>(days: T[]): T[] {
  const first = days.findIndex((d) => d.steps > 0)
  return first < 0 ? [] : days.slice(first)
}

/**
 * Свежие шаги из Health Connect поверх сохранённых. День с нулём не затирает сохранённое:
 * Health Connect отдаёт только последние 30 дней, а за старые дни вернёт нули.
 * Возвращает null, если ничего не изменилось, — тогда и сохранять нечего.
 */
export function mergeSteps(
  history: Record<ISODate, number>,
  fresh: { date: ISODate; steps: number }[],
): Record<ISODate, number> | null {
  let changed = false
  const next = { ...history }
  for (const d of fresh) {
    if (d.steps > 0 && next[d.date] !== d.steps) {
      next[d.date] = d.steps
      changed = true
    }
  }
  return changed ? next : null
}

/** `days` дней по `to` включительно, от старых к новым; дней без записи — ноль. */
export function stepsDays(
  history: Record<ISODate, number>,
  to: ISODate,
  days: number,
): { date: ISODate; steps: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(to, i - days + 1)
    return { date, steps: history[date] ?? 0 }
  })
}
