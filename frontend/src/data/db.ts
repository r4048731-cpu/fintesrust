// База IndexedDB через Dexie (архитектура, раздел 7.3).
// Новые версии схемы добавляются вызовом this.version(n + 1).stores(...).upgrade(...),
// старые версии не удаляются: по ним Dexie мигрирует данные на телефоне.

import { Dexie, type EntityTable } from 'dexie'
import type { Exercise, MetaRecord, Program, Workout } from '../domain/types'

export const SCHEMA_VERSION = 1

export class FitnessDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  programs!: EntityTable<Program, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>

  constructor(name = 'fitnes') {
    super(name)
    this.version(1).stores({
      exercises: 'id, muscle, name, updatedAt',
      programs: 'id, updatedAt',
      workouts: 'id, date, status, *exerciseIds, updatedAt',
      meta: 'key',
    })
  }
}
