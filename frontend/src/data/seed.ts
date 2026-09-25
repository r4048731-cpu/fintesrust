// Стартовый набор упражнений (ТЗ 2.1). Загружается один раз при первом запуске.
// id постоянные, чтобы импорт резервной копии не создавал дубликаты.

import type { Exercise, ExerciseType, MuscleGroup } from '../domain/types'
import { SCHEMA_VERSION, type FitnessDB } from './db'
import { metaRepo } from './repositories/meta'

type SeedRow = [id: string, name: string, muscle: MuscleGroup, type?: ExerciseType]

const ROWS: SeedRow[] = [
  ['bench-press', 'Жим штанги лёжа', 'chest'],
  ['incline-db-press', 'Жим гантелей на наклонной скамье', 'chest'],
  ['db-bench-press', 'Жим гантелей лёжа', 'chest'],
  ['dips', 'Отжимания на брусьях', 'chest', 'bodyweight'],
  ['cable-fly', 'Сведения рук в кроссовере', 'chest'],
  ['push-up', 'Отжимания от пола', 'chest', 'bodyweight'],
  ['deadlift', 'Становая тяга', 'back'],
  ['barbell-row', 'Тяга штанги в наклоне', 'back'],
  ['pull-up', 'Подтягивания', 'back', 'bodyweight'],
  ['lat-pulldown', 'Тяга верхнего блока', 'back'],
  ['seated-cable-row', 'Тяга горизонтального блока', 'back'],
  ['db-row', 'Тяга гантели одной рукой', 'back'],
  ['squat', 'Приседания со штангой', 'legs'],
  ['leg-press', 'Жим ногами', 'legs'],
  ['romanian-deadlift', 'Румынская тяга', 'legs'],
  ['db-lunge', 'Выпады с гантелями', 'legs'],
  ['leg-extension', 'Разгибания ног в тренажёре', 'legs'],
  ['leg-curl', 'Сгибания ног в тренажёре', 'legs'],
  ['calf-raise', 'Подъёмы на носки', 'legs'],
  ['overhead-press', 'Жим штанги стоя', 'shoulders'],
  ['seated-db-press', 'Жим гантелей сидя', 'shoulders'],
  ['lateral-raise', 'Махи гантелями в стороны', 'shoulders'],
  ['face-pull', 'Тяга каната к лицу', 'shoulders'],
  ['barbell-curl', 'Подъём штанги на бицепс', 'arms'],
  ['hammer-curl', 'Молотки с гантелями', 'arms'],
  ['triceps-pushdown', 'Разгибания рук на блоке', 'arms'],
  ['skull-crusher', 'Французский жим', 'arms'],
  ['plank', 'Планка', 'core', 'time'],
  ['crunch', 'Скручивания', 'core', 'bodyweight'],
  ['hanging-leg-raise', 'Подъём ног в висе', 'core', 'bodyweight'],
  ['exercise-bike', 'Велотренажёр', 'cardio', 'time'],
]

export function builtinExercises(now: number): Exercise[] {
  return ROWS.map(([id, name, muscle, type = 'weight']) => ({
    id: `builtin-${id}`,
    name,
    muscle,
    type,
    note: '',
    builtin: true,
    updatedAt: now,
    deletedAt: null,
  }))
}

/** Заполняет пустую базу. Повторный вызов ничего не делает. Возвращает true, если заполнил. */
export async function seedIfEmpty(db: FitnessDB, now = Date.now()): Promise<boolean> {
  const meta = metaRepo(db)
  return db.transaction('rw', db.exercises, db.meta, async () => {
    if (await meta.get('seeded')) return false
    await db.exercises.bulkPut(builtinExercises(now))
    await meta.set('schemaVersion', SCHEMA_VERSION)
    await meta.set('seeded', true)
    return true
  })
}
