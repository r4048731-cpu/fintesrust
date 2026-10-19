// Напоминание о тренировке (Android): дни недели, текст уведомления и подпись в настройках.

import { plural } from './plural'
import type { ProgramDay, Workout } from './types'

/** День недели: 1 — понедельник … 7 — воскресенье (как в java.time). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
]

/** «Верх A · 6 упражнений» — заголовок уведомления после «Сегодня:». */
export function reminderTitle(day: ProgramDay | null): string {
  if (!day) return ''
  const n = day.items.length
  return n ? `${day.name} · ${n} ${plural(n, 'упражнение', 'упражнения', 'упражнений')}` : day.name
}

/** Дата последней завершённой тренировки: в этот день напоминание не нужно. */
export function lastDoneDate(workouts: Workout[]): string {
  return workouts.reduce(
    (d, w) => (w.status === 'done' && w.deletedAt === null && w.date > d ? w.date : d),
    '',
  )
}

/** «Пн, Ср, Пт в 19:00», «Каждый день в 7:30». */
export function reminderSummary(days: Weekday[], time: string): string {
  const at = `в ${time.replace(/^0(\d)/, '$1')}`
  if (days.length === 7) return `Каждый день ${at}`
  if (!days.length) return 'Дни не выбраны'
  const labels = WEEKDAYS.filter((d) => days.includes(d.value)).map((d) => d.label)
  return `${labels.join(', ')} ${at}`
}
