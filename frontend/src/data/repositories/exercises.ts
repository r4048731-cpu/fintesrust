import { filterExercises, hasDuplicateName, type ExerciseFilter } from '../../domain/exercises'
import type { Exercise, ExerciseType, ID, MuscleGroup } from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'
import { newId } from '../../domain/id'

export interface ExerciseInput {
  name: string
  muscle: MuscleGroup
  type: ExerciseType
  note?: string
}

export type { ExerciseFilter }

/** Ошибка ввода: текст показывается пользователю как есть. */
export class ExerciseValidationError extends Error {}

export function exercisesRepo(db: FitnessDB, clock: Clock) {
  async function validateName(name: string, exceptId?: ID): Promise<string> {
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean) throw new ExerciseValidationError('Введите название упражнения')
    if (hasDuplicateName(await db.exercises.toArray(), clean, exceptId)) {
      throw new ExerciseValidationError(`Упражнение «${clean}» уже есть в справочнике`)
    }
    return clean
  }

  return {
    /** Неудалённые упражнения по алфавиту. */
    async list(filter: ExerciseFilter = {}): Promise<Exercise[]> {
      return filterExercises(await db.exercises.toArray(), filter)
    },

    /** Возвращает и удалённые упражнения: они нужны, чтобы показать старые тренировки. */
    get(id: ID): Promise<Exercise | undefined> {
      return db.exercises.get(id)
    },

    async create(input: ExerciseInput): Promise<Exercise> {
      const exercise: Exercise = {
        id: newId(),
        name: await validateName(input.name),
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
      if (!current || current.deletedAt !== null) {
        throw new ExerciseValidationError('Упражнение не найдено: возможно, его уже удалили')
      }
      const next: Exercise = {
        ...current,
        ...patch,
        name: patch.name !== undefined ? await validateName(patch.name, id) : current.name,
        note: patch.note?.trim() ?? current.note,
        updatedAt: clock(),
      }
      await db.exercises.put(next)
      return next
    },

    /** Мягкое удаление: в истории и программах упражнение остаётся с прежним названием. */
    async remove(id: ID): Promise<void> {
      await db.exercises.update(id, { deletedAt: clock(), updatedAt: clock() })
    },
  }
}
