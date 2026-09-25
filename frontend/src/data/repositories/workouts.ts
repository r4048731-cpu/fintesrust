import {
  countable,
  doneSets,
  findNewRecords,
  toISODate,
  type NewRecord,
} from '../../domain/metrics'
import type {
  ExerciseType,
  ID,
  PlanItem,
  Workout,
  WorkoutEntry,
  WorkoutSet,
} from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'
import { programsRepo } from './programs'
import { newId } from '../../domain/id'

export class ActiveWorkoutExistsError extends Error {
  constructor() {
    super('Уже есть незавершённая тренировка. Завершите или отмените её.')
  }
}

export class NothingDoneError extends Error {
  constructor() {
    super('Нет выполненных подходов. Отметьте хотя бы один подход или отмените тренировку.')
  }
}

export interface FinishResult {
  workout: Workout
  records: NewRecord[]
}

const DEFAULT_REPS = 10
const DEFAULT_TIME_SEC = 60
const DEFAULT_SETS = 3
const DEFAULT_REST_SEC = 90

const newestFirst = (a: Workout, b: Workout) =>
  b.date.localeCompare(a.date) || b.startedAt - a.startedAt

function withIndex(workout: Workout, now: number): Workout {
  return {
    ...workout,
    exerciseIds: [...new Set(workout.entries.map((e) => e.exerciseId))],
    updatedAt: now,
  }
}

/**
 * Подходы для нового упражнения в тренировке: вес и повторения берутся из прошлого раза
 * (i-й подход из i-го, лишние — из последнего), иначе из плана, иначе значения по умолчанию.
 */
export function prefillSets(
  type: ExerciseType,
  plan: Omit<PlanItem, 'exerciseId' | 'restSec'> | null,
  last: WorkoutSet[] | null,
): WorkoutSet[] {
  const count = plan?.sets || last?.length || DEFAULT_SETS
  const sets: WorkoutSet[] = []
  for (let i = 0; i < count; i++) {
    const prev = last?.[i] ?? last?.[last.length - 1]
    if (type === 'time') {
      sets.push({
        weightKg: 0,
        reps: 0,
        timeSec: prev?.timeSec ?? (plan?.repsMax || DEFAULT_TIME_SEC),
        done: false,
      })
    } else {
      sets.push({
        weightKg: prev?.weightKg ?? plan?.weightKg ?? 0,
        reps: prev?.reps ?? (plan?.repsMax || DEFAULT_REPS),
        done: false,
      })
    }
  }
  return sets
}

export function workoutsRepo(db: FitnessDB, clock: Clock) {
  const programs = programsRepo(db, clock)

  async function typeOf(exerciseId: ID): Promise<ExerciseType> {
    return (await db.exercises.get(exerciseId))?.type ?? 'weight'
  }

  /** Завершённые тренировки с упражнением, новые сверху (через мульти-индекс). */
  async function forExercise(exerciseId: ID): Promise<Workout[]> {
    const rows = await db.workouts.where('exerciseIds').equals(exerciseId).toArray()
    return countable(rows).sort(newestFirst)
  }

  async function lastSets(exerciseId: ID, excludeId?: ID): Promise<WorkoutSet[] | null> {
    for (const w of await forExercise(exerciseId)) {
      if (w.id === excludeId) continue
      const sets = w.entries
        .filter((e) => e.exerciseId === exerciseId)
        .flatMap((e) => doneSets(e.sets))
      if (sets.length) return sets
    }
    return null
  }

  async function buildEntry(
    exerciseId: ID,
    item: PlanItem | null,
    excludeId?: ID,
  ): Promise<WorkoutEntry> {
    const plan = item
      ? { sets: item.sets, repsMin: item.repsMin, repsMax: item.repsMax, weightKg: item.weightKg }
      : null
    return {
      exerciseId,
      restSec: item?.restSec ?? DEFAULT_REST_SEC,
      plan,
      sets: prefillSets(await typeOf(exerciseId), plan, await lastSets(exerciseId, excludeId)),
    }
  }

  async function getActive(): Promise<Workout | null> {
    const rows = await db.workouts.where('status').equals('active').toArray()
    return rows.filter((w) => w.deletedAt === null).sort(newestFirst)[0] ?? null
  }

  async function createActive(
    name: string,
    programId: ID | null,
    dayId: ID | null,
    entries: WorkoutEntry[],
  ): Promise<Workout> {
    const now = clock()
    const workout = withIndex(
      {
        id: newId(),
        date: toISODate(new Date(now)),
        name,
        programId,
        dayId,
        status: 'active',
        startedAt: now,
        finishedAt: null,
        note: '',
        entries,
        exerciseIds: [],
        updatedAt: now,
        deletedAt: null,
      },
      now,
    )
    await db.workouts.add(workout)
    return workout
  }

  return {
    getActive,
    forExercise,
    lastSets,
    buildEntry,

    get(id: ID): Promise<Workout | undefined> {
      return db.workouts.get(id)
    },

    /** Завершённые тренировки, новые сверху. */
    async listDone(): Promise<Workout[]> {
      const rows = await db.workouts.where('status').equals('done').toArray()
      return countable(rows).sort(newestFirst)
    },

    /**
     * Начать тренировку по дню программы или без плана (`from` = null).
     * План дня копируется в тренировку, чтобы правка программы не меняла историю.
     */
    async start(from: { programId: ID; dayId: ID } | null): Promise<Workout> {
      if (await getActive()) throw new ActiveWorkoutExistsError()
      const program = from ? await programs.get(from.programId) : undefined
      const day = program?.days.find((d) => d.id === from?.dayId)
      if (from && !day) throw new Error('День программы не найден')
      const entries: WorkoutEntry[] = []
      for (const item of day?.items ?? []) entries.push(await buildEntry(item.exerciseId, item))
      return createActive(
        day?.name ?? 'Свободная тренировка',
        program?.id ?? null,
        day?.id ?? null,
        entries,
      )
    },

    /**
     * Повторить прошедшую тренировку: те же упражнения и число подходов, а вес и повторы —
     * из последнего раза, как при обычном старте. С программой не связывается,
     * чтобы повтор не сдвигал её следующий день.
     */
    async repeat(sourceId: ID): Promise<Workout> {
      if (await getActive()) throw new ActiveWorkoutExistsError()
      const source = await db.workouts.get(sourceId)
      if (!source || source.status !== 'done' || source.deletedAt !== null) {
        throw new Error('Тренировка для повтора не найдена')
      }
      const entries: WorkoutEntry[] = []
      for (const e of source.entries) {
        const timed = (await typeOf(e.exerciseId)) === 'time'
        const values = e.sets.map((s) => (timed ? (s.timeSec ?? 0) : s.reps))
        const plan = e.plan ?? {
          sets: e.sets.length,
          repsMin: Math.min(...values),
          repsMax: Math.max(...values),
          weightKg: Math.max(...e.sets.map((s) => s.weightKg)),
        }
        const item: PlanItem = {
          exerciseId: e.exerciseId,
          restSec: e.restSec,
          ...plan,
          sets: e.sets.length,
        }
        entries.push(await buildEntry(e.exerciseId, item))
      }
      return createActive(source.name, null, null, entries)
    },

    /** Сохранить изменения: вызывается после каждого действия в активной тренировке и при правке истории. */
    async save(workout: Workout): Promise<Workout> {
      const next = withIndex(workout, clock())
      await db.workouts.put(next)
      return next
    },

    /**
     * Завершить тренировку: остаются только выполненные подходы, считаются рекорды,
     * указатель программы переходит на следующий день.
     */
    async finish(id: ID): Promise<FinishResult> {
      return db.transaction('rw', db.workouts, db.exercises, db.programs, db.meta, async () => {
        const current = await db.workouts.get(id)
        if (!current || current.status !== 'active')
          throw new Error('Активная тренировка не найдена')
        const entries = current.entries
          .map((e) => ({ ...e, sets: doneSets(e.sets) }))
          .filter((e) => e.sets.length > 0)
        if (!entries.length) throw new NothingDoneError()
        const now = clock()
        const workout = withIndex({ ...current, entries, status: 'done', finishedAt: now }, now)

        const previous = new Map<ID, Workout>()
        for (const exId of workout.exerciseIds) {
          for (const w of await forExercise(exId)) previous.set(w.id, w)
        }
        const types = new Map<ID, ExerciseType>()
        for (const exId of workout.exerciseIds) types.set(exId, await typeOf(exId))
        const records = findNewRecords(
          workout,
          [...previous.values()],
          (exId) => types.get(exId) ?? 'weight',
        )

        await db.workouts.put(workout)
        if (workout.programId && workout.dayId)
          await programs.advanceAfter(workout.programId, workout.dayId)
        return { workout, records }
      })
    },

    /** Отменить активную тренировку без сохранения. */
    async discard(id: ID): Promise<void> {
      const w = await db.workouts.get(id)
      if (w?.status === 'active') await db.workouts.delete(id)
    },

    /** Мягкое удаление завершённой тренировки. */
    async remove(id: ID): Promise<void> {
      await db.workouts.update(id, { deletedAt: clock(), updatedAt: clock() })
    },
  }
}
