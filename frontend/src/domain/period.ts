import { addDays } from './nutrition'
import type { ISODate } from './types'

/** Период графика, как «Неделя ▾» в приложениях статистики. */
export type Period = 'week' | 'month' | 'quarter' | 'all'

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: '3 месяца' },
  { value: 'all', label: 'Всё время' },
]

const DAYS: Record<Exclude<Period, 'all'>, number> = { week: 7, month: 30, quarter: 90 }

/** Записи за период по полю date, включая сегодня. */
export function inPeriod<T extends { date: ISODate }>(
  rows: T[],
  period: Period,
  today: ISODate,
): T[] {
  if (period === 'all') return rows
  const from = addDays(today, -(DAYS[period] - 1))
  return rows.filter((r) => r.date >= from && r.date <= today)
}
