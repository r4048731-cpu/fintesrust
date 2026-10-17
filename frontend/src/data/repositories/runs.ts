import { newId } from '../../domain/id'
import { finishRun, type Run, type RunGoal, type RunKind } from '../../domain/run'
import type { ID } from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'

/** Вес по умолчанию для калорий, если вес тела ещё не записан. */
const DEFAULT_BODY_KG = 70

/** Короче этого пробежка не сохраняется — случайное нажатие «Старт». */
export const MIN_RUN_M = 50

export class ActiveRunExistsError extends Error {
  constructor() {
    super('Уже идёт пробежка — продолжите или завершите её.')
  }
}

export function runsRepo(db: FitnessDB, clock: Clock) {
  async function getActive(): Promise<Run | null> {
    const rows = await db.runs.where('status').equals('active').toArray()
    return rows.find((r) => r.deletedAt === null) ?? null
  }

  return {
    getActive,

    async get(id: ID): Promise<Run | undefined> {
      const r = await db.runs.get(id)
      return r && r.deletedAt === null ? r : undefined
    },

    /** Завершённые, новые сверху. */
    async list(): Promise<Run[]> {
      const rows = await db.runs.where('status').equals('done').toArray()
      return rows.filter((r) => r.deletedAt === null).sort((a, b) => b.startedAt - a.startedAt)
    },

    async start(kind: RunKind, goal: RunGoal): Promise<Run> {
      if (await getActive()) throw new ActiveRunExistsError()
      const weights = await db.bodyWeights.orderBy('date').reverse().toArray()
      const bodyKg = weights.find((w) => w.deletedAt === null)?.weightKg ?? DEFAULT_BODY_KG
      const now = clock()
      const run: Run = {
        id: newId(),
        kind,
        goal,
        status: 'active',
        startedAt: now,
        finishedAt: null,
        segments: [[]],
        movingMs: 0,
        resumedAt: now,
        distanceM: 0,
        climbM: 0,
        bodyKg,
        updatedAt: now,
        deletedAt: null,
      }
      await db.runs.add(run)
      return run
    },

    async save(run: Run): Promise<void> {
      await db.runs.put({ ...run, updatedAt: clock() })
    },

    /** Завершить. Слишком короткая пробежка удаляется — возвращается null. */
    async finish(run: Run): Promise<Run | null> {
      const done = finishRun(run, clock())
      if (done.distanceM < MIN_RUN_M) {
        await db.runs.delete(run.id)
        return null
      }
      await db.runs.put({ ...done, updatedAt: clock() })
      return done
    },

    /** Отменить идущую пробежку без сохранения. */
    async discard(id: ID): Promise<void> {
      await db.runs.delete(id)
    },

    async remove(id: ID): Promise<void> {
      await db.runs.update(id, { deletedAt: clock(), updatedAt: clock() })
    },
  }
}
