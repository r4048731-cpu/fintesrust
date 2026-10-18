import { describe, expect, it } from 'vitest'
import type { Workout } from '../src/domain/types'
import {
  addSet,
  addWarmup,
  adjustRest,
  applyWeightToOpenSets,
  allDone,
  changeDate,
  countSets,
  formatClock,
  formatDuration,
  formatSet,
  keepDone,
  moveEntry,
  removeLastSet,
  removeWarmup,
  setValue,
  stopRest,
  toggleDone,
  toggleSetOnly,
  warmupSets,
} from '../src/domain/workout'
import { doneSets } from '../src/domain/metrics'

const T0 = 1_000_000

function workout(): Workout {
  return {
    id: 'w',
    date: '2026-09-25',
    name: 'Верх',
    programId: null,
    dayId: null,
    status: 'active',
    startedAt: T0,
    finishedAt: null,
    note: '',
    exerciseIds: ['bench', 'row'],
    updatedAt: T0,
    deletedAt: null,
    entries: [
      {
        exerciseId: 'bench',
        restSec: 90,
        plan: null,
        sets: [
          { weightKg: 60, reps: 10, done: false },
          { weightKg: 60, reps: 10, done: false },
          { weightKg: 60, reps: 8, done: false },
        ],
      },
      {
        exerciseId: 'row',
        restSec: 60,
        plan: null,
        sets: [{ weightKg: 50, reps: 12, done: false }],
      },
    ],
  }
}

describe('правка подходов', () => {
  it('новый вес подтягивает следующие невыполненные подходы с тем же весом', () => {
    const w = setValue(workout(), 0, 0, 'weightKg', 62.5)
    expect(w.entries[0].sets.map((s) => s.weightKg)).toEqual([62.5, 62.5, 62.5])
    // второй подход поправили отдельно — третий идёт за ним, первый не трогается
    const w2 = setValue(w, 0, 1, 'weightKg', 65)
    expect(w2.entries[0].sets.map((s) => s.weightKg)).toEqual([62.5, 65, 65])
  })

  it('повторы подтягивают только подходы с тем же старым значением и не трогают выполненные', () => {
    let w = toggleDone(workout(), 0, 1, T0)
    w = setValue(w, 0, 0, 'reps', 12)
    expect(w.entries[0].sets.map((s) => s.reps)).toEqual([12, 10, 8])
  })

  it('значения не выходят за пределы и округляются', () => {
    const w = setValue(workout(), 0, 0, 'weightKg', -5)
    expect(w.entries[0].sets[0].weightKg).toBe(0)
    expect(setValue(workout(), 0, 0, 'reps', 7.6).entries[0].sets[0].reps).toBe(8)
  })

  it('подход добавляется копией последнего, последний подход не удаляется', () => {
    const w = addSet(workout(), 1)
    expect(w.entries[1].sets).toEqual([
      { weightKg: 50, reps: 12, done: false },
      { weightKg: 50, reps: 12, done: false },
    ])
    expect(removeLastSet(removeLastSet(w, 1), 1).entries[1].sets).toHaveLength(1)
  })

  it('упражнения переставляются', () => {
    expect(moveEntry(workout(), 1, -1).entries.map((e) => e.exerciseId)).toEqual(['row', 'bench'])
    expect(moveEntry(workout(), 0, -1).entries.map((e) => e.exerciseId)).toEqual(['bench', 'row'])
  })
})

describe('отдых', () => {
  it('отметка подхода запускает отдых из плана упражнения', () => {
    const w = toggleDone(workout(), 0, 0, T0)
    expect(w.entries[0].sets[0].done).toBe(true)
    expect(w.restEndsAt).toBe(T0 + 90_000)
    expect(w.restTotalSec).toBe(90)
  })

  it('снятие отметки не трогает отдых, последний подход тренировки отдых не запускает', () => {
    let w = toggleDone(workout(), 0, 0, T0)
    w = toggleDone(w, 0, 0, T0 + 5000)
    expect(w.entries[0].sets[0].done).toBe(false)
    expect(w.restEndsAt).toBe(T0 + 90_000)

    let all = workout()
    for (const [e, s] of [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
    ] as const)
      all = toggleDone(all, e, s, T0)
    expect(allDone(all)).toBe(true)
    expect(all.restEndsAt).toBeNull()
  })

  it('отдых можно продлить, сократить (не раньше «сейчас») и пропустить', () => {
    const w = toggleDone(workout(), 0, 0, T0)
    expect(adjustRest(w, 15, T0).restEndsAt).toBe(T0 + 105_000)
    expect(adjustRest(w, -300, T0 + 10_000).restEndsAt).toBe(T0 + 10_000)
    expect(stopRest(w).restEndsAt).toBeNull()
  })

  it('считает подходы', () => {
    expect(countSets(toggleDone(workout(), 0, 0, T0))).toEqual({ done: 1, total: 4 })
  })
})

describe('подписи', () => {
  it('formatSet, formatClock, formatDuration', () => {
    expect(formatSet({ weightKg: 62.5, reps: 8, done: true }, 'weight')).toBe('62,5 × 8')
    expect(formatSet({ weightKg: 0, reps: 12, done: true }, 'bodyweight')).toBe('12')
    expect(formatSet({ weightKg: 10, reps: 8, done: true }, 'bodyweight')).toBe('+10 × 8')
    expect(formatSet({ weightKg: 0, reps: 0, timeSec: 45, done: true }, 'time')).toBe('45 с')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatDuration(48 * 60000)).toBe('48 мин')
    expect(formatDuration(72 * 60000)).toBe('1 ч 12 мин')
    expect(formatDuration(120 * 60000)).toBe('2 ч')
  })
})

describe('правка прошлой тренировки', () => {
  it('keepDone оставляет только отмеченные подходы и непустые упражнения', () => {
    const w = keepDone(toggleDone(workout(), 0, 1, T0))
    expect(w.entries).toHaveLength(1)
    expect(w.entries[0].sets).toEqual([{ weightKg: 60, reps: 10, done: true }])
    expect(w.restEndsAt).toBeNull()
  })

  it('подход при правке добавляется сразу отмеченным, отметка не запускает отдых', () => {
    expect(addSet(workout(), 1, true).entries[1].sets[1].done).toBe(true)
    const w = toggleSetOnly(workout(), 0, 0)
    expect(w.entries[0].sets[0].done).toBe(true)
    expect(w.restEndsAt).toBeUndefined()
  })

  it('перенос даты сдвигает начало и конец на те же сутки', () => {
    const w = { ...workout(), status: 'done' as const, finishedAt: T0 + 3_600_000 }
    const moved = changeDate(w, '2026-09-20')
    expect(moved.date).toBe('2026-09-20')
    expect(moved.startedAt).toBe(T0 - 5 * 86_400_000)
    expect(moved.finishedAt! - moved.startedAt).toBe(3_600_000)
    expect(changeDate(w, 'мусор')).toBe(w)
  })
})

describe('разминка', () => {
  it('40/60/80% рабочего веса с округлением до шага, не легче грифа', () => {
    expect(warmupSets(100, 2.5, 20)).toEqual([
      { weightKg: 40, reps: 8, done: false, warmup: true },
      { weightKg: 60, reps: 5, done: false, warmup: true },
      { weightKg: 80, reps: 3, done: false, warmup: true },
    ])
    // 40 кг: 16 → гриф 20, 24 → 25, 32 → 32,5
    expect(warmupSets(40, 2.5, 20).map((s) => s.weightKg)).toEqual([20, 25, 32.5])
    // лёгкий вес: всё упирается в гриф, повторы не дублируются
    expect(warmupSets(25, 2.5, 20).map((s) => s.weightKg)).toEqual([20])
    expect(warmupSets(20, 2.5, 20)).toEqual([])
  })

  it('ставится перед рабочими подходами и убирается обратно', () => {
    const w = addWarmup(workout(), 0, 2.5, 20)
    expect(w.entries[0].sets.map((s) => [s.weightKg, !!s.warmup])).toEqual([
      [25, true],
      [35, true],
      [47.5, true],
      [60, false],
      [60, false],
      [60, false],
    ])
    expect(removeWarmup(w, 0).entries[0].sets).toEqual(workout().entries[0].sets)
  })

  it('не идёт в статистику, а сделанная остаётся в тренировке', () => {
    let w = addWarmup(workout(), 0, 2.5, 20)
    w = toggleDone(w, 0, 0, T0)
    expect(doneSets(w.entries[0].sets)).toEqual([])
    expect(removeWarmup(w, 0).entries[0].sets[0]).toMatchObject({ warmup: true, done: true })
  })

  it('отдых после разминки — не дольше минуты', () => {
    const w = toggleDone(addWarmup(workout(), 0, 2.5, 20), 0, 0, T0)
    expect(w.restEndsAt).toBe(T0 + 60_000)
  })

  it('рабочий вес, «− подход» и новый подход разминку не трогают', () => {
    let w = addWarmup(workout(), 0, 2.5, 20)
    w = applyWeightToOpenSets(w, 0, 70)
    expect(w.entries[0].sets.map((s) => s.weightKg)).toEqual([25, 35, 47.5, 70, 70, 70])
    w = setValue(w, 0, 3, 'reps', 5)
    expect(w.entries[0].sets[0].reps).toBe(8)
    w = removeLastSet(removeLastSet(removeLastSet(w, 0), 0), 0)
    expect(w.entries[0].sets.filter((s) => !s.warmup)).toHaveLength(1)
    expect(addSet(w, 0).entries[0].sets.at(-1)?.warmup).toBeUndefined()
  })
})
