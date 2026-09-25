import { describe, expect, it } from 'vitest'
import { builtinExercises } from '../src/data/seed'
import { PROGRAM_TEMPLATES } from '../src/domain/templates'
import {
  applyWeightToOpenSets,
  nextOpenSet,
  progressionHint,
  toggleDone,
} from '../src/domain/workout'
import type { Workout, WorkoutEntry } from '../src/domain/types'
import { DAY, setup } from './helpers'

describe('шаблоны программ', () => {
  it('все упражнения шаблонов есть в стартовом наборе, у каждого дня есть упражнения', () => {
    const ids = new Set(builtinExercises(0).map((e) => e.id))
    for (const t of PROGRAM_TEMPLATES) {
      expect(t.days.length).toBeGreaterThan(0)
      for (const d of t.days) {
        expect(d.items.length).toBeGreaterThan(0)
        for (const i of d.items)
          expect(ids, `${t.name} / ${d.name}: ${i.exerciseId}`).toContain(i.exerciseId)
      }
    }
  })

  it('программа из шаблона получает свои id дней и не делит массивы с шаблоном', async () => {
    const r = await setup()
    const a = await r.programs.create('Фулбади', 'fullbody')
    const b = await r.programs.create('Фулбади', 'fullbody')
    expect(a.days.map((d) => d.name)).toEqual(['Фулбади A', 'Фулбади B'])
    expect(a.days[0].id).not.toBe(b.days[0].id)
    a.days[0].items[0].sets = 10
    expect(PROGRAM_TEMPLATES[0].days[0].items[0].sets).toBe(4)
  })
})

const entry = (
  sets: [number, number, boolean?][],
  plan = { sets: 3, repsMin: 8, repsMax: 10, weightKg: 60 },
): WorkoutEntry => ({
  exerciseId: 'bench',
  restSec: 90,
  plan,
  sets: sets.map(([weightKg, reps, done = false]) => ({ weightKg, reps, done })),
})

describe('подсказка прогрессии', () => {
  const prevTop = [
    { weightKg: 60, reps: 10, done: true },
    { weightKg: 60, reps: 10, done: true },
    { weightKg: 60, reps: 11, done: true },
  ]

  it('все подходы на верхней границе — предлагает +шаг', () => {
    const e = entry([
      [60, 10],
      [60, 10],
      [60, 10],
    ])
    expect(progressionHint(e, prevTop, 'weight', 2.5)).toEqual({ weightKg: 62.5, setsToChange: 3 })
  })

  it('нет подсказки: недобор повторов, меньше подходов, без плана, не вес, уже поставлен', () => {
    const e = entry([
      [60, 10],
      [60, 10],
      [60, 10],
    ])
    expect(
      progressionHint(
        e,
        [...prevTop.slice(0, 2), { weightKg: 60, reps: 9, done: true }],
        'weight',
        2.5,
      ),
    ).toBeNull()
    expect(progressionHint(e, prevTop.slice(0, 2), 'weight', 2.5)).toBeNull()
    expect(progressionHint({ ...e, plan: null }, prevTop, 'weight', 2.5)).toBeNull()
    expect(progressionHint(e, prevTop, 'bodyweight', 2.5)).toBeNull()
    expect(
      progressionHint(
        entry([
          [62.5, 10],
          [62.5, 10],
          [62.5, 10],
        ]),
        prevTop,
        'weight',
        2.5,
      ),
    ).toBeNull()
  })

  it('«Поставить» меняет только невыполненные подходы; следующий подход — первый невыполненный', () => {
    let w = {
      entries: [
        entry([
          [60, 10, true],
          [60, 10],
          [60, 10],
        ]),
      ],
    } as unknown as Workout
    w = applyWeightToOpenSets(w, 0, 62.5)
    expect(w.entries[0].sets.map((s) => s.weightKg)).toEqual([60, 62.5, 62.5])
    expect(nextOpenSet(w)).toEqual({ ei: 0, si: 1 })
    w = toggleDone(toggleDone(w, 0, 1, 0), 0, 2, 0)
    expect(nextOpenSet(w)).toBeNull()
  })
})

describe('повтор тренировки', () => {
  it('те же упражнения и число подходов, вес — из последнего раза, без связи с программой', async () => {
    const r = await setup()
    const p = await r.programs.create('Верх/Низ', 'upperlower')
    const first = await r.workouts.start({ programId: p.id, dayId: p.days[0].id })
    first.entries = [
      {
        ...first.entries[0],
        sets: [
          { weightKg: 60, reps: 8, done: true },
          { weightKg: 60, reps: 7, done: true },
        ],
      },
    ]
    await r.workouts.save(first)
    await r.workouts.finish(first.id)
    r.clock.advance(DAY)
    // более поздняя тренировка с тем же упражнением — вес берётся из неё
    const later = await r.workouts.start(null)
    later.entries.push({
      ...(await r.workouts.buildEntry('builtin-bench-press', null)),
      sets: [{ weightKg: 65, reps: 5, done: true }],
    })
    await r.workouts.save(later)
    await r.workouts.finish(later.id)
    const pointer = await r.programs.nextDay(p.id)

    r.clock.advance(DAY)
    const again = await r.workouts.repeat(first.id)
    expect(again).toMatchObject({ name: 'Верх', programId: null, dayId: null, status: 'active' })
    expect(again.entries).toHaveLength(1)
    expect(again.entries[0].sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [65, 5],
      [65, 5],
    ])
    again.entries[0].sets[0].done = true
    await r.workouts.save(again)
    await r.workouts.finish(again.id)
    expect(await r.programs.nextDay(p.id)).toEqual(pointer)
  })
})
