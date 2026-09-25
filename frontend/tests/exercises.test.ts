import { describe, expect, it } from 'vitest'
import { ExerciseValidationError } from '../src/data/repositories/exercises'
import { filterExercises, hasDuplicateName, normalizeName } from '../src/domain/exercises'
import type { Exercise } from '../src/domain/types'
import { setup } from './helpers'

const ex = (id: string, name: string, extra: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  muscle: 'chest',
  type: 'weight',
  note: '',
  builtin: true,
  updatedAt: 0,
  deletedAt: null,
  ...extra,
})

describe('поиск упражнений', () => {
  const list = [
    ex('1', 'Жим штанги лёжа'),
    ex('2', 'Приседания', { muscle: 'legs' }),
    ex('3', 'Жим ногами', { muscle: 'legs' }),
    ex('4', 'Жим стоя', { muscle: 'shoulders', deletedAt: 5 }),
  ]

  it('не различает регистр, ё и е, лишние пробелы', () => {
    expect(normalizeName('  Жим   ЛЁЖА ')).toBe('жим лежа')
    expect(filterExercises(list, { query: 'лежа' }).map((e) => e.id)).toEqual(['1'])
  })

  it('фильтрует по группе мышц и сортирует по алфавиту, без удалённых', () => {
    expect(filterExercises(list, { muscle: 'legs' }).map((e) => e.name)).toEqual([
      'Жим ногами',
      'Приседания',
    ])
    expect(filterExercises(list, { query: 'жим' }).map((e) => e.id)).toEqual(['3', '1'])
  })

  it('находит дубликаты названий, кроме удалённых и самого себя', () => {
    expect(hasDuplicateName(list, 'жим штанги ЛЕЖА')).toBe(true)
    expect(hasDuplicateName(list, 'Жим штанги лёжа', '1')).toBe(false)
    expect(hasDuplicateName(list, 'Жим стоя')).toBe(false)
  })
})

describe('справочник в базе', () => {
  it('не даёт создать дубликат или переименовать в существующее', async () => {
    const r = await setup()
    await expect(
      r.exercises.create({ name: 'жим штанги лежа', muscle: 'chest', type: 'weight' }),
    ).rejects.toBeInstanceOf(ExerciseValidationError)

    const own = await r.exercises.create({ name: 'Жим в Смите', muscle: 'chest', type: 'weight' })
    await expect(r.exercises.update(own.id, { name: 'Подтягивания' })).rejects.toThrow(
      'уже есть в справочнике',
    )
    // своё же название при сохранении без изменений — не дубликат
    await expect(r.exercises.update(own.id, { name: 'Жим в Смите' })).resolves.toBeTruthy()
  })

  it('после удаления название снова свободно', async () => {
    const r = await setup()
    const own = await r.exercises.create({ name: 'Жим в Смите', muscle: 'chest', type: 'weight' })
    await r.exercises.remove(own.id)
    await expect(
      r.exercises.create({ name: 'Жим в Смите', muscle: 'chest', type: 'weight' }),
    ).resolves.toBeTruthy()
  })
})
