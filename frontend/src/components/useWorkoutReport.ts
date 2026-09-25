import { useLiveQuery } from 'dexie-react-hooks'
import type { Repositories } from '../data'
import { findNewRecords, type NewRecord } from '../domain/metrics'
import type { Exercise, Workout } from '../domain/types'

export interface WorkoutReportData {
  workout: Workout
  exercises: Map<string, Exercise>
  records: NewRecord[]
}

/**
 * Завершённая тренировка с названиями упражнений и рекордами, поставленными в ней.
 * `undefined` — ещё загружается, `null` — нет такой тренировки (или она удалена).
 */
export function useWorkoutReport(repos: Repositories, workoutId: string) {
  return useLiveQuery(async (): Promise<WorkoutReportData | null> => {
    const workout = await repos.workouts.get(workoutId)
    if (!workout || workout.status !== 'done' || workout.deletedAt !== null) return null
    const exercises = new Map<string, Exercise>()
    for (const id of workout.exerciseIds) {
      const e = await repos.exercises.get(id)
      if (e) exercises.set(id, e)
    }
    // Рекорды считаются относительно тренировок, которые были раньше этой
    const earlier = (await repos.workouts.listDone()).filter(
      (w) => w.date < workout.date || (w.date === workout.date && w.startedAt < workout.startedAt),
    )
    const records = findNewRecords(workout, earlier, (id) => exercises.get(id)?.type ?? 'weight')
    return { workout, exercises, records }
  }, [repos, workoutId])
}
