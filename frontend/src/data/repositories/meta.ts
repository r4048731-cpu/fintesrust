import type { MetaKey, MetaValues } from '../../domain/types'
import type { FitnessDB } from '../db'

export const META_DEFAULTS: MetaValues = {
  schemaVersion: 0,
  seeded: false,
  seedVersion: 0,
  weightStepKg: 2.5,
  activeProgramId: null,
  nextDayIndex: {},
  lastExportAt: null,
  nutritionPlan: null,
  bodyProfile: null,
  favoriteRecipes: [],
  aiChat: [],
  aiUseContext: true,
  runVoice: true,
}

export function metaRepo(db: FitnessDB) {
  return {
    async get<K extends MetaKey>(key: K): Promise<MetaValues[K]> {
      const row = await db.meta.get(key)
      return row ? (row.value as MetaValues[K]) : META_DEFAULTS[key]
    },

    async set<K extends MetaKey>(key: K, value: MetaValues[K]): Promise<void> {
      await db.meta.put({ key, value })
    },
  }
}
