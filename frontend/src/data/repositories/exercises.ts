import type { Exercise, ExerciseType, ID, MuscleGroup } from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'

export interface ExerciseInput {
  name: string
  muscle: MuscleGroup
  type: ExerciseType
  note?: string
}

export interface ExerciseFilter {
  muscle?: MuscleGroup
  /** Поиск по подстроке в названии, без учёта регистра. */
  query?: string
}

const collator = new Intl.Collator('ru')

export function exercisesRepo(db: FitnessDB, clock: Clock) {
  return {
    /** Неудалённые упражнения по алфавиту. */
    async list(filter: ExerciseFilter = {}): Promise<Exercise[]> {
      const q = filter.query?.trim().toLocaleLowerCase('ru') ?? ''
      const rows = filter.muscle
        ? await db.exercises.where('muscle').equals(filter.muscle).toArray()
        : await db.exercises.toArray()
      return rows
        .filter((e) => e.deletedAt === null)
        .filter((e) => !q || e.name.toLocaleLowerCase('ru').includes(q))
        .sort((a, b) => collator.compare(a.name, b.name))
    },

    /** Возвращает и удалённые упражнения: они нужны, чтобы показать старые тренировки. */
    get(id: ID): Promise<Exercise | undefined> {
      return db.exercises.get(id)
    },

    async create(input: ExerciseInput): Promise<Exercise> {
      const name = input.name.trim()
      if (!name) throw new Error('Название упражнения не может быть пустым')
      const exercise: Exercise = {
        id: crypto.randomUUID(),
        name,
        muscle: input.muscle,
        type: input.type,
        note: input.note?.trim() ?? '',
        builtin: false,
        updatedAt: clock(),
        deletedAt: null,
      }
      await db.exercises.add(exercise)
      return exercise
    },

    async update(id: ID, patch: Partial<ExerciseInput>): Promise<Exercise> {
      const current = await db.exercises.get(id)
      if (!current || current.deletedAt !== null) throw new Error(`Упражнение ${id} не найдено`)
      const name = patch.name?.trim()
      if (patch.name !== undefined && !name)
        throw new Error('Название упражнения не может быть пустым')
      const next: Exercise = {
        ...current,
        ...patch,
        name: name ?? current.name,
        note: patch.note?.trim() ?? current.note,
        updatedAt: clock(),
      }
      await db.exercises.put(next)
      return next
    },

    /** Мягкое удаление: в истории упражнение остаётся с прежним названием. */
    async remove(id: ID): Promise<void> {
      await db.exercises.update(id, { deletedAt: clock(), updatedAt: clock() })
    },
  }
}
