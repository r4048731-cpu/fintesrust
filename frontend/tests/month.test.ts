import { describe, expect, it } from 'vitest'
import {
  deltaText,
  formatHours,
  formatHoursShort,
  formatTonnage,
} from '../src/components/monthImage'
import { monthSummary, monthTitle, shiftMonth } from '../src/domain/month'
import type { Run } from '../src/domain/run'
import type { Workout, WorkoutSet } from '../src/domain/types'

const set = (weightKg: number, reps: number, warmup?: boolean): WorkoutSet => ({
  weightKg,
  reps,
  done: true,
  ...(warmup ? { warmup } : {}),
})

function workout(date: string, entries: Record<string, WorkoutSet[]>, minutes = 60): Workout {
  const startedAt = new Date(`${date}T10:00`).getTime()
  return {
    id: `w-${date}-${Object.keys(entries).join()}`,
    date,
    name: 'Тест',
    programId: null,
    dayId: null,
    status: 'done',
    startedAt,
    finishedAt: startedAt + minutes * 60000,
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
  }
}

const run = (date: string, km: number): Run =>
  ({
    status: 'done',
    deletedAt: null,
    startedAt: new Date(`${date}T08:00`).getTime(),
    distanceM: km * 1000,
  }) as Run

const type = () => 'weight' as const

describe('итоги месяца', () => {
  const all = [
    workout('2026-09-20', { bench: [set(60, 8)] }),
    workout('2026-10-02', { bench: [set(20, 10, true), set(62.5, 8)], squat: [set(80, 5)] }),
    workout('2026-10-02', { row: [set(50, 10)] }, 30),
    workout('2026-10-09', { bench: [set(65, 6), set(65, 6)] }),
    workout('2026-11-01', { bench: [set(70, 5)] }),
  ]

  it('считает тренировки, дни, тоннаж, подходы и время — без разминки', () => {
    const s = monthSummary(all, [run('2026-10-05', 5.2), run('2026-09-30', 3)], '2026-10', type)
    expect(s).toMatchObject({
      workouts: 3,
      days: 2,
      sets: 5,
      minutes: 150,
      runs: 1,
      prevWorkouts: 1,
    })
    expect(s.tonnageKg).toBe(62.5 * 8 + 80 * 5 + 50 * 10 + 65 * 12)
    expect(s.runKm).toBeCloseTo(5.2)
    expect(s.top).toEqual({ exerciseId: 'bench', sets: 3 })
  })

  it('рекорд месяца — последний, «было» — до начала месяца', () => {
    const s = monthSummary(all, [], '2026-10', type)
    expect(s.records).toEqual([{ exerciseId: 'bench', kind: 'weight', value: 65, previous: 60 }])
  })

  it('пустой месяц', () => {
    expect(monthSummary(all, [], '2026-08', type)).toMatchObject({
      workouts: 0,
      records: [],
      top: null,
    })
  })

  it('соседние месяцы и подпись', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(monthTitle('2026-10')).toBe('Октябрь 2026')
  })
})

describe('подписи итогов', () => {
  it('тоннаж, время, сравнение с прошлым месяцем', () => {
    expect(formatTonnage(83_040)).toBe('83 т')
    expect(formatTonnage(18_440)).toBe('18,4 т')
    expect(formatTonnage(850)).toBe('850 кг')
    expect(formatHours(585)).toBe('9 ч 45 мин')
    expect(formatHours(45)).toBe('45 мин')
    expect(formatHoursShort(585)).toBe('9,8 ч')
    const s = { workouts: 9, prevWorkouts: 15 } as Parameters<typeof deltaText>[0]
    expect(deltaText(s, '2026-09')).toBe('−6 к сентябрю')
    expect(deltaText(s, '2026-09', true)).toBe('')
    expect(deltaText({ ...s, workouts: 17 }, '2026-09', true)).toBe('+2 к сентябрю')
  })
})
