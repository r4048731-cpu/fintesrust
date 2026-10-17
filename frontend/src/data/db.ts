// База IndexedDB через Dexie (архитектура, раздел 7.3).
// Новые версии схемы добавляются вызовом this.version(n + 1).stores(...).upgrade(...),
// старые версии не удаляются: по ним Dexie мигрирует данные на телефоне.

import type { Run } from '../domain/run'
import { Dexie, type EntityTable } from 'dexie'
import type {
  BodyWeight,
  CustomRecipe,
  Exercise,
  Meal,
  MetaRecord,
  Note,
  Program,
  Workout,
} from '../domain/types'

export const SCHEMA_VERSION = 6

export class FitnessDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  programs!: EntityTable<Program, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>
  bodyWeights!: EntityTable<BodyWeight, 'id'>
  meals!: EntityTable<Meal, 'id'>
  notes!: EntityTable<Note, 'id'>
  recipes!: EntityTable<CustomRecipe, 'id'>
  runs!: EntityTable<Run, 'id'>

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
    // Версия 3: питание. Новая таблица, старые данные не трогаются.
    this.version(3).stores({
      meals: 'id, date',
    })
    // Версия 4: заметки. Новая таблица, старые данные не трогаются.
    this.version(4).stores({
      notes: 'id, updatedAt',
    })
    // Версия 5: свои блюда. Новая таблица, старые данные не трогаются.
    this.version(5).stores({
      recipes: 'id, updatedAt',
    })
    // Версия 6: пробежки и прогулки по GPS. Новая таблица, старые данные не трогаются.
    this.version(6).stores({
      runs: 'id, status, startedAt',
    })
  }
}
