// Точка входа в слой данных. Экраны работают только через эти репозитории
// и не обращаются к базе напрямую (архитектура, раздел 7.2).

import { FitnessDB } from './db'
import { systemClock, type Clock } from './repositories/clock'
import { exercisesRepo } from './repositories/exercises'
import { metaRepo } from './repositories/meta'
import { programsRepo } from './repositories/programs'
import { workoutsRepo } from './repositories/workouts'
import { seedIfEmpty } from './seed'

export function createRepositories(db: FitnessDB, clock: Clock = systemClock) {
  return {
    db,
    exercises: exercisesRepo(db, clock),
    programs: programsRepo(db, clock),
    workouts: workoutsRepo(db, clock),
    meta: metaRepo(db),
    /** Вызвать один раз при запуске приложения. */
    init: () => seedIfEmpty(db, clock()),
  }
}

export type Repositories = ReturnType<typeof createRepositories>

export { FitnessDB } from './db'
export { ActiveWorkoutExistsError, NothingDoneError } from './repositories/workouts'
