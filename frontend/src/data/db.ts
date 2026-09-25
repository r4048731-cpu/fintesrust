// База IndexedDB через Dexie (архитектура, раздел 7.3).
// Новые версии схемы добавляются вызовом this.version(n + 1).stores(...).upgrade(...),
// старые версии не удаляются: по ним Dexie мигрирует данные на телефоне.

import { Dexie, type EntityTable } from 'dexie'
import type { BodyWeight, Exercise, MetaRecord, Program, Workout } from '../domain/types'

export const SCHEMA_VERSION = 2

export class FitnessDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  programs!: EntityTable<Program, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>
  bodyWeights!: EntityTable<BodyWeight, 'id'>

  constructor(name = 'fitnes') {
    super(name)
    this.version(1).stores({
      exercises: 'id, muscle, name, updatedAt',
      programs: 'id, updatedAt',
      workouts: 'id, date, status, *exerciseIds, updatedAt',
      meta: 'key',
    })
    // Версия 2: вес тела. Старые таблицы не меняются, данные переносить не нужно.
    this.version(2).stores({
      bodyWeights: 'id, date',
    })
  }
}
