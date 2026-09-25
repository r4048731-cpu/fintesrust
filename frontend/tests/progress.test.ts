import { describe, expect, it } from 'vitest'
import { niceDomain, niceStep } from '../src/components/charts/scale'
import { activitySummary, exerciseUsage } from '../src/domain/metrics'
import type { Workout, WorkoutSet } from '../src/domain/types'

let seq = 0
function workout(
  date: string,
  entries: Record<string, WorkoutSet[]>,
  extra: Partial<Workout> = {},
): Workout {
  return {
    id: `w${++seq}`,
    date,
    name: 'Т',
    programId: null,
    dayId: null,
    status: 'done',
    startedAt: seq,
    finishedAt: seq,
    note: '',
    entries: Object.entries(entries).map(([exerciseId, sets]) => ({
      exerciseId,
      restSec: 90,
      plan: null,
      sets,
    })),
    exerciseIds: Object.keys(entries),
    updatedAt: 0,
    deletedAt: null,
    ...extra,
  }
}
const s = (weightKg: number, reps: number, done = true): WorkoutSet => ({ weightKg, reps, done })

describe('шкала графика', () => {
  it('шаг из ряда 1, 2, 2,5, 5', () => {
    expect(niceStep(40)).toBe(10)
    expect(niceStep(9)).toBe(2.5)
    expect(niceStep(0.7)).toBe(0.2)
  })

  it('границы с запасом, не ниже нуля, деления включают края', () => {
    expect(niceDomain([62.5, 80])).toEqual({ lo: 60, hi: 80, ticks: [60, 65, 70, 75, 80] })
    expect(niceDomain([3, 4]).lo).toBeGreaterThanOrEqual(0)
    const flat = niceDomain([100, 100])
    expect(flat.lo).toBeLessThan(100)
    expect(flat.hi).toBeGreaterThan(100)
  })
})

describe('общая статистика', () => {
  it('считает упражнения только по выполненным подходам и завершённым тренировкам', () => {
    const list = [
      workout('2026-09-20', { bench: [s(60, 10)], squat: [s(100, 5, false)] }),
      workout('2026-09-22', { bench: [s(62.5, 8)] }),
      workout('2026-09-23', { bench: [s(70, 5)] }, { deletedAt: 1 }),
    ]
    expect([...exerciseUsage(list)]).toEqual([['bench', 2]])
  })

  it('7 и 30 дней считаются включая сегодня', () => {
    const now = new Date(2026, 8, 25, 12)
    const list = [
      workout('2026-09-25', { bench: [s(100, 10)] }),
      workout('2026-09-19', { bench: [s(50, 10)] }),
      workout('2026-09-18', { bench: [s(50, 10)] }),
      workout('2026-08-27', { bench: [s(50, 10)] }),
      workout('2026-08-26', { bench: [s(50, 10)] }),
    ]
    expect(activitySummary(list, now)).toEqual({ last7: 2, last30: 4, tonnage7Kg: 1500, total: 5 })
  })
})
