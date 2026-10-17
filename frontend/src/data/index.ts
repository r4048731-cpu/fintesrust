// Точка входа в слой данных. Экраны работают только через эти репозитории
// и не обращаются к базе напрямую (архитектура, раздел 7.2).

import { FitnessDB } from './db'
import { bodyWeightsRepo } from './repositories/bodyWeights'
import { systemClock, type Clock } from './repositories/clock'
import { exercisesRepo } from './repositories/exercises'
import { mealsRepo } from './repositories/meals'
import { metaRepo } from './repositories/meta'
import { notesRepo } from './repositories/notes'
import { programsRepo } from './repositories/programs'
import { recipesRepo } from './repositories/recipes'
import { runsRepo } from './repositories/runs'
import { workoutsRepo } from './repositories/workouts'
import { seedIfEmpty } from './seed'

export function createRepositories(db: FitnessDB, clock: Clock = systemClock) {
  const meta = metaRepo(db)
  return {
    db,
    exercises: exercisesRepo(db, clock),
    programs: programsRepo(db, clock),
    workouts: workoutsRepo(db, clock),
    meta,
    bodyWeights: bodyWeightsRepo(db, clock),
    meals: mealsRepo(db, clock),
    notes: notesRepo(db, clock),
    recipes: recipesRepo(db, clock, meta),
    runs: runsRepo(db, clock),
    /** Вызвать один раз при запуске приложения. */
    init: () => seedIfEmpty(db, clock()),
  }
}

export type Repositories = ReturnType<typeof createRepositories>

export { FitnessDB } from './db'
export { ActiveWorkoutExistsError, NothingDoneError } from './repositories/workouts'
