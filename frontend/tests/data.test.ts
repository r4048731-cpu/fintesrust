import { describe, expect, it } from 'vitest'
import {
  ActiveWorkoutExistsError,
  createRepositories,
  FitnessDB,
  NothingDoneError,
} from '../src/data'
import { newPlanItem } from '../src/domain/programs'
import { seedIfEmpty } from '../src/data/seed'
import { DAY, setup } from './helpers'

const BENCH = 'builtin-bench-press'
const SQUAT = 'builtin-squat'
const PLANK = 'builtin-plank'

/** Программа «Верх/Низ» из двух дней с планом. */
async function upperLower(r: Awaited<ReturnType<typeof setup>>) {
  const p = await r.programs.create('Верх/Низ')
  p.days[0].name = 'Верх'
  p.days[0].items = [
    {
      ...newPlanItem({ id: BENCH, type: 'weight' }),
      sets: 3,
      repsMin: 8,
      repsMax: 10,
      weightKg: 60,
    },
  ]
  p.days.push({
    id: crypto.randomUUID(),
    name: 'Низ',
    items: [newPlanItem({ id: SQUAT, type: 'weight' })],
  })
  return r.programs.save(p)
}

describe('стартовые данные', () => {
  it('загружаются один раз', async () => {
    const r = await setup()
    const count = (await r.exercises.list()).length
    expect(count).toBeGreaterThanOrEqual(30)
    expect(await seedIfEmpty(r.db)).toBe(false)
    expect((await r.exercises.list()).length).toBe(count)
    expect(await r.meta.get('schemaVersion')).toBe(1)
    expect(await r.meta.get('weightStepKg')).toBe(2.5)
  })
})

describe('упражнения', () => {
  it('поиск, фильтр по группе мышц и сортировка по алфавиту', async () => {
    const r = await setup()
    const found = await r.exercises.list({ query: 'ЖИМ' })
    expect(found.every((e) => e.name.toLowerCase().includes('жим'))).toBe(true)
    const legs = await r.exercises.list({ muscle: 'legs' })
    expect(legs.length).toBeGreaterThan(0)
    expect(legs.every((e) => e.muscle === 'legs')).toBe(true)
    const names = legs.map((e) => e.name)
    expect(names).toEqual([...names].sort(new Intl.Collator('ru').compare))
  })

  it('своё упражнение: создать, изменить, удалить', async () => {
    const r = await setup()
    const ex = await r.exercises.create({ name: '  Жим в Смите ', muscle: 'chest', type: 'weight' })
    expect(ex.name).toBe('Жим в Смите')
    expect(ex.builtin).toBe(false)
    await r.exercises.update(ex.id, { note: 'Скамья на 30°' })
    expect((await r.exercises.get(ex.id))?.note).toBe('Скамья на 30°')
    await r.exercises.remove(ex.id)
    expect((await r.exercises.list()).some((e) => e.id === ex.id)).toBe(false)
    // для старых тренировок упражнение остаётся доступным по id
    expect((await r.exercises.get(ex.id))?.name).toBe('Жим в Смите')
  })

  it('не создаёт упражнение без названия', async () => {
    const r = await setup()
    await expect(
      r.exercises.create({ name: '  ', muscle: 'chest', type: 'weight' }),
    ).rejects.toThrow()
  })
})

describe('программы', () => {
  it('первая программа становится активной, дни идут по кругу', async () => {
    const r = await setup()
    const p = await upperLower(r)
    expect((await r.programs.getActive())?.id).toBe(p.id)
    expect((await r.programs.nextDay(p.id))?.day.name).toBe('Верх')
    await r.programs.advanceAfter(p.id, p.days[0].id)
    expect((await r.programs.nextDay(p.id))?.day.name).toBe('Низ')
    await r.programs.advanceAfter(p.id, p.days[1].id)
    expect((await r.programs.nextDay(p.id))?.day.name).toBe('Верх')
  })

  it('копия получает новые id, удаление активной переключает активную', async () => {
    const r = await setup()
    const p = await upperLower(r)
    const copy = await r.programs.duplicate(p.id)
    expect(copy.id).not.toBe(p.id)
    expect(copy.days[0].id).not.toBe(p.days[0].id)
    expect(copy.days[0].items).toEqual(p.days[0].items)
    await r.programs.remove(p.id)
    expect((await r.programs.getActive())?.id).toBe(copy.id)
    expect((await r.programs.list()).map((x) => x.id)).toEqual([copy.id])
  })

  it('не сохраняет программу без дней', async () => {
    const r = await setup()
    const p = await r.programs.create()
    await expect(r.programs.save({ ...p, days: [] })).rejects.toThrow()
  })
})

describe('тренировки', () => {
  it('старт по дню копирует план, подставляет плановый вес и максимум повторений', async () => {
    const r = await setup()
    const p = await upperLower(r)
    const w = await r.workouts.start({ programId: p.id, dayId: p.days[0].id })
    expect(w.status).toBe('active')
    expect(w.name).toBe('Верх')
    expect(w.exerciseIds).toEqual([BENCH])
    expect(w.entries[0].plan).toEqual({ sets: 3, repsMin: 8, repsMax: 10, weightKg: 60 })
    expect(w.entries[0].sets).toEqual([
      { weightKg: 60, reps: 10, done: false },
      { weightKg: 60, reps: 10, done: false },
      { weightKg: 60, reps: 10, done: false },
    ])
  })

  it('вторую активную тренировку начать нельзя', async () => {
    const r = await setup()
    await r.workouts.start(null)
    await expect(r.workouts.start(null)).rejects.toBeInstanceOf(ActiveWorkoutExistsError)
  })

  it('активная тренировка переживает перезапуск приложения', async () => {
    const r = await setup()
    const w = await r.workouts.start(null)
    w.entries.push(await r.workouts.buildEntry(BENCH, null))
    w.entries[0].sets[0] = { weightKg: 40, reps: 12, done: true }
    await r.workouts.save(w)

    // тот же файл базы открывается заново, как после перезагрузки страницы
    r.db.close()
    const reopened = createRepositories(new FitnessDB(r.db.name), r.clock)
    const active = await reopened.workouts.getActive()
    expect(active?.id).toBe(w.id)
    expect(active?.entries[0].sets[0]).toEqual({ weightKg: 40, reps: 12, done: true })
  })

  it('завершение оставляет выполненные подходы, сдвигает день и не даёт рекорда в первый раз', async () => {
    const r = await setup()
    const p = await upperLower(r)
    const w = await r.workouts.start({ programId: p.id, dayId: p.days[0].id })
    w.entries[0].sets[0].done = true
    w.entries[0].sets[1].done = true
    await r.workouts.save(w)
    r.clock.advance(50 * 60 * 1000)

    const { workout, records } = await r.workouts.finish(w.id)
    expect(workout.status).toBe('done')
    expect(workout.finishedAt! - workout.startedAt).toBe(50 * 60 * 1000)
    expect(workout.entries[0].sets).toHaveLength(2)
    expect(records).toEqual([])
    expect(await r.workouts.getActive()).toBeNull()
    expect((await r.programs.nextDay(p.id))?.day.name).toBe('Низ')
  })

  it('без выполненных подходов завершить нельзя', async () => {
    const r = await setup()
    const w = await r.workouts.start(null)
    w.entries.push(await r.workouts.buildEntry(BENCH, null))
    await r.workouts.save(w)
    await expect(r.workouts.finish(w.id)).rejects.toBeInstanceOf(NothingDoneError)
  })

  it('следующая тренировка подставляет веса из прошлой и находит рекорд', async () => {
    const r = await setup()
    const p = await upperLower(r)

    const first = await r.workouts.start({ programId: p.id, dayId: p.days[0].id })
    first.entries[0].sets = [
      { weightKg: 60, reps: 10, done: true },
      { weightKg: 62.5, reps: 8, done: true },
      { weightKg: 62.5, reps: 6, done: true },
    ]
    await r.workouts.save(first)
    await r.workouts.finish(first.id)

    r.clock.advance(3 * DAY)
    const second = await r.workouts.start({ programId: p.id, dayId: p.days[0].id })
    expect(second.entries[0].sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [60, 10],
      [62.5, 8],
      [62.5, 6],
    ])

    second.entries[0].sets[2] = { weightKg: 65, reps: 5, done: true }
    await r.workouts.save(second)
    const { records } = await r.workouts.finish(second.id)
    expect(records).toEqual([{ exerciseId: BENCH, kind: 'weight', value: 65, previous: 62.5 }])
  })

  it('поиск по упражнению идёт через индекс и не видит удалённые тренировки', async () => {
    const r = await setup()
    const w = await r.workouts.start(null)
    w.entries.push(await r.workouts.buildEntry(PLANK, null))
    expect(w.entries[0].sets[0]).toEqual({ weightKg: 0, reps: 0, timeSec: 60, done: false })
    w.entries[0].sets[0].done = true
    await r.workouts.save(w)
    await r.workouts.finish(w.id)

    expect((await r.workouts.forExercise(PLANK)).map((x) => x.id)).toEqual([w.id])
    expect(await r.workouts.forExercise(BENCH)).toEqual([])
    await r.workouts.remove(w.id)
    expect(await r.workouts.forExercise(PLANK)).toEqual([])
    expect(await r.workouts.listDone()).toEqual([])
  })

  it('отмена удаляет активную тренировку', async () => {
    const r = await setup()
    const w = await r.workouts.start(null)
    await r.workouts.discard(w.id)
    expect(await r.workouts.get(w.id)).toBeUndefined()
  })
})
