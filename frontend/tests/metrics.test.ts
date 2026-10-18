import { describe, expect, it } from 'vitest'
import {
  activityGrid,
  estimate1RM,
  exerciseHistory,
  findNewRecords,
  personalRecords,
  recordFromSet,
  weekStart,
  weeklyTonnage,
  workoutTonnage,
  weekStreak,
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

describe('weekStreak', () => {
  // воскресенье 2026-10-18; недели начинаются 12 окт, 5 окт, 28 сен
  const now = new Date(2026, 9, 18)
  const done = (...dates: string[]) => dates.map((d) => workout(d, { bench: [set(60, 10)] }))

  it('считает недели подряд с выполненной целью, включая текущую', () => {
    const list = done(
      '2026-10-13',
      '2026-10-15',
      '2026-10-06',
      '2026-10-09',
      '2026-09-29',
      '2026-10-01',
    )
    expect(weekStreak(list, 2, now)).toEqual({ weeks: 3, thisWeek: 2, goal: 2, met: true })
  })

  it('незаконченная текущая неделя серию не обрывает', () => {
    const list = done('2026-10-14', '2026-10-06', '2026-10-09', '2026-09-29', '2026-10-01')
    expect(weekStreak(list, 2, now)).toEqual({ weeks: 2, thisWeek: 1, goal: 2, met: false })
  })

  it('пропущенная неделя обрывает серию', () => {
    const list = done('2026-10-13', '2026-10-15', '2026-09-29', '2026-10-01')
    expect(weekStreak(list, 2, now).weeks).toBe(1)
  })

  it('удалённые и незавершённые тренировки не считаются', () => {
    const list = [
      workout('2026-10-13', {}, { deletedAt: 5 }),
      workout('2026-10-14', {}, { status: 'active' }),
    ]
    expect(weekStreak(list, 1, now)).toEqual({ weeks: 0, thisWeek: 0, goal: 1, met: false })
  })
})

describe('activityGrid', () => {
  const now = new Date(2026, 9, 14) // среда

  it('строит столбцы-недели с понедельника, последний — текущая неделя', () => {
    const grid = activityGrid([], 3, now)
    expect(grid).toHaveLength(3)
    expect(grid[0][0].date).toBe('2026-09-28')
    expect(grid[2].map((d) => d.date)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ])
    expect(grid[2].map((d) => d.future)).toEqual([false, false, false, true, true, true, true])
  })

  it('яркость — по тоннажу относительно самого тяжёлого дня; без тоннажа — средняя', () => {
    const grid = activityGrid(
      [
        workout('2026-10-12', { bench: [set(100, 10)] }), // 1000 кг — максимум
        workout('2026-10-13', { bench: [set(20, 10)] }), // 200 кг
        workout('2026-10-14', { plank: [set(0, 1)] }), // без тоннажа
      ],
      1,
      now,
    )
    expect(grid[0].slice(0, 4).map((d) => d.level)).toEqual([4, 1, 2, 0])
    expect(grid[0][0]).toMatchObject({ workouts: 1, tonnageKg: 1000 })
  })
})

describe('recordFromSet', () => {
  const type = () => 'weight' as const
  const history = [workout('2026-10-01', { bench: [set(70, 8), set(70, 8)] })]
  const bench = (...sets: WorkoutSet[]) => workout('2026-10-15', { bench: sets }, { id: 'now' })

  it('подход тяжелее прошлого максимума — рекорд веса', () => {
    const before = bench(set(70, 8), set(72.5, 6, false))
    const after = bench(set(70, 8), set(72.5, 6))
    expect(recordFromSet(before, after, history, 'bench', type)).toMatchObject({
      kind: 'weight',
      value: 72.5,
      previous: 70,
    })
  })

  it('рекорд уже стоял раньше в этой тренировке — повтор не считается', () => {
    const before = bench(set(72.5, 6), set(72.5, 6, false))
    const after = bench(set(72.5, 6), set(72.5, 6))
    expect(recordFromSet(before, after, history, 'bench', type)).toBeNull()
  })

  it('обычный подход рекорда не даёт', () => {
    const before = bench(set(70, 8, false))
    const after = bench(set(70, 8))
    expect(recordFromSet(before, after, history, 'bench', type)).toBeNull()
  })
})
