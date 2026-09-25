import { describe, expect, it } from 'vitest'
import {
  estimate1RM,
  exerciseHistory,
  findNewRecords,
  personalRecords,
  weekStart,
  weeklyTonnage,
  workoutTonnage,
  toISODate,
} from '../src/domain/metrics'
import type { Workout, WorkoutSet } from '../src/domain/types'

const set = (weightKg: number, reps: number, done = true): WorkoutSet => ({ weightKg, reps, done })

let seq = 0
function workout(
  date: string,
  entries: Record<string, WorkoutSet[]>,
  extra: Partial<Workout> = {},
): Workout {
  return {
    id: `w${++seq}`,
    date,
    name: 'Тест',
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

describe('estimate1RM', () => {
  it('считает по формуле Эпли', () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 2)
    expect(estimate1RM(60, 5)).toBe(70)
  })

  it('для одного повторения возвращает сам вес', () => {
    expect(estimate1RM(120, 1)).toBe(120)
  })

  it('без веса или повторений возвращает 0', () => {
    expect(estimate1RM(0, 10)).toBe(0)
    expect(estimate1RM(100, 0)).toBe(0)
  })
})

describe('workoutTonnage', () => {
  it('суммирует только выполненные подходы', () => {
    const w = workout('2026-09-21', {
      bench: [set(60, 10), set(60, 8), set(60, 8, false)],
      squat: [set(100, 5)],
    })
    expect(workoutTonnage(w)).toBe(60 * 10 + 60 * 8 + 100 * 5)
  })
})

describe('exerciseHistory и personalRecords', () => {
  it('идут от старых тренировок к новым и пропускают удалённые и незавершённые', () => {
    const list = [
      workout('2026-09-20', { bench: [set(70, 5)] }),
      workout('2026-09-10', { bench: [set(60, 10), set(65, 6)] }),
      workout('2026-09-15', { bench: [set(80, 1)] }, { deletedAt: 1 }),
      workout('2026-09-22', { bench: [set(90, 1)] }, { status: 'active' }),
      workout('2026-09-12', { squat: [set(100, 5)] }),
    ]
    const h = exerciseHistory(list, 'bench')
    expect(h.map((s) => s.date)).toEqual(['2026-09-10', '2026-09-20'])
    expect(h[0].bestWeightKg).toBe(65)
    expect(h[0].best1RM).toBeCloseTo(80, 5)

    const pr = personalRecords(h)!
    expect(pr.maxWeightKg).toBe(70)
    expect(pr.max1RM).toBeCloseTo(81.67, 2)
    expect(pr.maxSetVolume).toBe(600)
  })

  it('без истории рекордов нет', () => {
    expect(personalRecords([])).toBeNull()
  })
})

describe('findNewRecords', () => {
  const type = () => 'weight' as const

  it('первая тренировка с упражнением не даёт рекорда', () => {
    const w = workout('2026-09-21', { bench: [set(60, 10)] })
    expect(findNewRecords(w, [], type)).toEqual([])
  })

  it('больший вес — рекорд веса', () => {
    const prev = workout('2026-09-14', { bench: [set(60, 10)] })
    const w = workout('2026-09-21', { bench: [set(62.5, 6)] })
    expect(findNewRecords(w, [prev], type)).toEqual([
      { exerciseId: 'bench', kind: 'weight', value: 62.5, previous: 60 },
    ])
  })

  it('тот же вес, больше повторений — рекорд 1ПМ', () => {
    const prev = workout('2026-09-14', { bench: [set(60, 8)] })
    const w = workout('2026-09-21', { bench: [set(60, 10)] })
    const [r] = findNewRecords(w, [prev], type)
    expect(r.kind).toBe('1rm')
    expect(r.value).toBeCloseTo(80, 5)
  })

  it('повтор прошлого результата рекордом не считается', () => {
    const prev = workout('2026-09-14', { bench: [set(60, 10)] })
    const w = workout('2026-09-21', { bench: [set(60, 10)] })
    expect(findNewRecords(w, [prev], type)).toEqual([])
  })

  it('для собственного веса сравниваются повторения', () => {
    const prev = workout('2026-09-14', { pullup: [set(0, 8)] })
    const w = workout('2026-09-21', { pullup: [set(0, 10)] })
    expect(findNewRecords(w, [prev], () => 'bodyweight')).toEqual([
      { exerciseId: 'pullup', kind: 'reps', value: 10, previous: 8 },
    ])
  })
})

describe('weeklyTonnage', () => {
  it('недели начинаются с понедельника', () => {
    expect(toISODate(weekStart(new Date(2026, 8, 27)))).toBe('2026-09-21') // воскресенье
    expect(toISODate(weekStart(new Date(2026, 8, 21)))).toBe('2026-09-21') // понедельник
  })

  it('раскладывает тоннаж по неделям, включая пустые', () => {
    const list = [
      workout('2026-09-22', { bench: [set(100, 10)] }),
      workout('2026-09-24', { squat: [set(100, 5)] }),
      workout('2026-09-08', { bench: [set(50, 10)] }),
      workout('2026-08-01', { bench: [set(50, 10)] }), // за пределами окна
    ]
    const weeks = weeklyTonnage(list, 3, new Date(2026, 8, 25))
    expect(weeks).toEqual([
      { weekStart: '2026-09-07', tonnageKg: 500, workouts: 1 },
      { weekStart: '2026-09-14', tonnageKg: 0, workouts: 0 },
      { weekStart: '2026-09-21', tonnageKg: 1500, workouts: 2 },
    ])
  })
})
