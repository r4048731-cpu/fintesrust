import { describe, expect, it } from 'vitest'
import {
  backupFileName,
  BackupError,
  backupIsDue,
  countBackup,
  createBackup,
  parseBackup,
  restoreBackup,
  wipeAll,
} from '../src/data/backup'
import { builtinExercises } from '../src/data/seed'
import { newPlanItem } from '../src/domain/programs'
import { DAY, setup } from './helpers'

type Repos = Awaited<ReturnType<typeof setup>>
/** Упражнений в стартовом наборе; в тестах ниже к ним добавляется одно своё. */
const BUILTIN = builtinExercises(0).length

/** Программа, своё упражнение, завершённая и удалённая тренировки, настройки. */
async function fill(r: Repos) {
  const own = await r.exercises.create({ name: 'Жим в Смите', muscle: 'chest', type: 'weight' })
  const p = await r.programs.create('Верх/Низ')
  p.days[0].items = [newPlanItem(own)]
  await r.programs.save(p)
  await r.programs.advanceAfter(p.id, p.days[0].id)
  await r.meta.set('weightStepKg', 1.25)
  for (const weight of [60, 65]) {
    const w = await r.workouts.start(null)
    w.entries.push({
      ...(await r.workouts.buildEntry(own.id, null)),
      sets: [{ weightKg: weight, reps: 8, done: true }],
    })
    await r.workouts.save(w)
    await r.workouts.finish(w.id)
    r.clock.advance(DAY)
  }
  const removed = (await r.workouts.listDone())[0]
  await r.workouts.remove(removed.id)
  await r.notes.add({ title: 'Тренажёр', text: 'Сиденье на 4' })
  const gone = await r.notes.add({ title: '', text: 'Удалённая' })
  await r.notes.remove(gone.id)
}

/** Снимок всех таблиц, чтобы сравнить «до» и «после». */
async function snapshot(r: Repos) {
  const byId = <T extends { id: string }>(l: T[]) => [...l].sort((a, b) => a.id.localeCompare(b.id))
  return {
    exercises: byId(await r.db.exercises.toArray()),
    programs: byId(await r.db.programs.toArray()),
    workouts: byId(await r.db.workouts.toArray()),
    notes: byId(await r.db.notes.toArray()),
    meta: (await r.db.meta.toArray())
      .filter((m) => m.key !== 'lastExportAt')
      .sort((a, b) => a.key.localeCompare(b.key)),
  }
}

describe('резервная копия', () => {
  it('экспорт → очистка → импорт возвращает все данные без потерь (критерий приёмки 7)', async () => {
    const r = await setup()
    await fill(r)
    const before = await snapshot(r)

    const file = JSON.stringify(await createBackup(r.db, r.clock()))
    await wipeAll(r.db)
    expect(await r.db.workouts.count()).toBe(0)

    const counts = await restoreBackup(r.db, parseBackup(file))
    expect(counts).toEqual({ exercises: BUILTIN + 1, programs: 1, workouts: 1 })
    expect(await snapshot(r)).toEqual(before)
    // после восстановления стартовый набор не добавляется второй раз
    expect(await r.init()).toBe(false)
  })

  it('восстановление на другом «телефоне» заменяет его данные', async () => {
    const source = await setup()
    await fill(source)
    const file = JSON.stringify(await createBackup(source.db, source.clock()))

    const target = await setup()
    await target.programs.create('Старая')
    await restoreBackup(target.db, parseBackup(file))
    expect((await target.programs.list()).map((p) => p.name)).toEqual(['Верх/Низ'])
    expect(await target.meta.get('weightStepKg')).toBe(1.25)
  })

  it('время последней копии не переносится и не затирается восстановлением', async () => {
    const r = await setup()
    await r.meta.set('lastExportAt', 123)
    const b = await createBackup(r.db, r.clock())
    expect(b.meta.some((m) => m.key === 'lastExportAt')).toBe(false)
    await restoreBackup(r.db, b)
    expect(await r.meta.get('lastExportAt')).toBe(123)
  })

  it('понятные ошибки на чужой и испорченный файл', () => {
    const err = (text: string) => {
      try {
        parseBackup(text)
      } catch (e) {
        expect(e).toBeInstanceOf(BackupError)
        return (e as Error).message
      }
      throw new Error('ошибки не было')
    }
    expect(err('не json')).toMatch(/не JSON/)
    expect(err('{"app":"other"}')).toMatch(/не резервная копия/)
    expect(err('{"app":"fitnes","version":99}')).toMatch(/более новой версией/)
    expect(
      err('{"app":"fitnes","version":1,"exercises":[{}],"programs":[],"workouts":[],"meta":[]}'),
    ).toMatch(/повреждены данные/)
  })

  it('испорченная копия не трогает текущие данные', async () => {
    const r = await setup()
    await fill(r)
    const before = await snapshot(r)
    const bad = { ...(await createBackup(r.db, r.clock())), workouts: [{ id: 'x' }] }
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(BackupError)
    expect(await snapshot(r)).toEqual(before)
  })

  it('имя файла, счётчики и напоминание раз в неделю', async () => {
    expect(backupFileName(new Date(2026, 8, 5, 10).getTime())).toBe('fitnes-2026-09-05.json')
    const r = await setup()
    await fill(r)
    expect(countBackup(await createBackup(r.db, 0))).toEqual({
      exercises: BUILTIN + 1,
      programs: 1,
      workouts: 1,
    })
    const now = 100 * DAY
    expect(backupIsDue(null, 0, now)).toBe(false)
    expect(backupIsDue(null, 1, now)).toBe(true)
    expect(backupIsDue(now - 6 * DAY, 1, now)).toBe(false)
    expect(backupIsDue(now - 8 * DAY, 1, now)).toBe(true)
  })
})
