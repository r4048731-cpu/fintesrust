// Резервная копия всех данных в одном JSON-файле (ТЗ, раздел 5; архитектура, решение 6).
// Копия содержит всё, включая удалённые записи: так её можно восстановить без потерь.

import type {
  BodyWeight,
  CustomRecipe,
  Exercise,
  Meal,
  Measurement,
  MetaKey,
  MetaRecord,
  Note,
  Program,
  ProgressPhoto,
  Workout,
} from '../domain/types'
import type { Run } from '../domain/run'
import { SCHEMA_VERSION, type FitnessDB } from './db'

export const BACKUP_APP = 'fitnes'

/**
 * Настройки, которые остаются на телефоне и в копию не попадают: время последней копии.
 * `aiKeys` — ключи ИИ из промежуточной версии: если они остались в базе, наружу не уходят.
 */
const DEVICE_ONLY: string[] = ['lastExportAt', 'aiKeys']
/** Версия формата файла. При изменении формата — поднять и дописать перевод в migrate(). */
export const BACKUP_VERSION = 1

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  schemaVersion: number
  exportedAt: string
  exercises: Exercise[]
  programs: Program[]
  workouts: Workout[]
  /** Появилось в схеме 2; в копиях, сделанных раньше, его нет. */
  bodyWeights: BodyWeight[]
  /** Появилось в схеме 3; в копиях, сделанных раньше, его нет. */
  meals: Meal[]
  /** Появилось в схеме 4; в копиях, сделанных раньше, его нет. */
  notes: Note[]
  /** Свои блюда; появились в схеме 5. Любимые рецепты хранятся в meta. */
  recipes: CustomRecipe[]
  /** Пробежки и прогулки; появились в схеме 6. */
  runs: Run[]
  /** Фото прогресса; появились в схеме 7. */
  photos: ProgressPhoto[]
  /** Замеры тела; появились в схеме 8. */
  measurements: Measurement[]
  meta: MetaRecord[]
}

export interface BackupCounts {
  exercises: number
  programs: number
  workouts: number
}

/** Ошибка разбора файла: текст показывается пользователю как есть. */
export class BackupError extends Error {}

export async function createBackup(db: FitnessDB, now: number): Promise<Backup> {
  return db.transaction(
    'r',
    [
      db.exercises,
      db.programs,
      db.workouts,
      db.bodyWeights,
      db.meals,
      db.notes,
      db.recipes,
      db.runs,
      db.photos,
      db.measurements,
      db.meta,
    ],
    async () => ({
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date(now).toISOString(),
      exercises: await db.exercises.toArray(),
      programs: await db.programs.toArray(),
      workouts: await db.workouts.toArray(),
      bodyWeights: await db.bodyWeights.toArray(),
      meals: await db.meals.toArray(),
      notes: await db.notes.toArray(),
      recipes: await db.recipes.toArray(),
      runs: await db.runs.toArray(),
      photos: await db.photos.toArray(),
      measurements: await db.measurements.toArray(),
      // Время последней копии — свойство устройства, а не данных: в файл не попадает
      meta: (await db.meta.toArray()).filter((m) => !DEVICE_ONLY.includes(m.key)),
    }),
  )
}

/** Сколько живых (неудалённых) записей в копии — для подтверждения перед восстановлением. */
export function countBackup(b: Backup): BackupCounts {
  const alive = <T extends { deletedAt: number | null }>(list: T[]) =>
    list.filter((x) => x.deletedAt === null).length
  return {
    exercises: alive(b.exercises),
    programs: alive(b.programs),
    workouts: b.workouts.filter((w) => w.deletedAt === null && w.status === 'done').length,
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const hasId = (v: unknown) => isObj(v) && typeof v.id === 'string' && v.id.length > 0

/** Разбирает текст файла и проверяет, что это наша копия. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('Файл повреждён или это не JSON. Выберите файл резервной копии.')
  }
  if (!isObj(data) || data.app !== BACKUP_APP) {
    throw new BackupError('Это не резервная копия приложения. Выберите файл fitnes-…json.')
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupError('Копия сделана более новой версией приложения. Обновите приложение.')
  }
  const b = migrate(data)
  for (const key of [
    'exercises',
    'programs',
    'workouts',
    'bodyWeights',
    'meals',
    'notes',
    'recipes',
    'runs',
    'photos',
    'measurements',
  ] as const) {
    const list = b[key] as unknown
    if (!Array.isArray(list) || !list.every(hasId)) {
      throw new BackupError('В копии повреждены данные. Восстановить её нельзя.')
    }
  }
  if (!Array.isArray(b.meta) || !b.meta.every((m) => isObj(m) && typeof m.key === 'string')) {
    throw new BackupError('В копии повреждены настройки. Восстановить её нельзя.')
  }
  const workoutsOk = b.workouts.every(
    (w) => typeof w.date === 'string' && Array.isArray(w.entries) && Array.isArray(w.exerciseIds),
  )
  if (!workoutsOk) throw new BackupError('В копии повреждены тренировки. Восстановить её нельзя.')
  return b
}

/** Перевод старых копий в текущий формат: в копиях до веса тела, питания, заметок и своих блюд нет этих списков. */
function migrate(data: Record<string, unknown>): Backup {
  const list = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    ...data,
    bodyWeights: list(data.bodyWeights),
    meals: list(data.meals),
    notes: list(data.notes),
    recipes: list(data.recipes),
    runs: list(data.runs),
    photos: list(data.photos),
    measurements: list(data.measurements),
  } as unknown as Backup
}

/**
 * Заменяет все данные на копию. Всё в одной транзакции: при ошибке база остаётся прежней.
 * Незавершённая тренировка на этом устройстве пропадает вместе с остальными данными.
 */
export async function restoreBackup(db: FitnessDB, b: Backup): Promise<BackupCounts> {
  await db.transaction(
    'rw',
    [
      db.exercises,
      db.programs,
      db.workouts,
      db.bodyWeights,
      db.meals,
      db.notes,
      db.recipes,
      db.runs,
      db.photos,
      db.measurements,
      db.meta,
    ],
    async () => {
      const kept = (await db.meta.bulkGet(DEVICE_ONLY as MetaKey[])).filter((m) => m !== undefined)
      await Promise.all([
        db.exercises.clear(),
        db.programs.clear(),
        db.workouts.clear(),
        db.bodyWeights.clear(),
        db.meals.clear(),
        db.notes.clear(),
        db.recipes.clear(),
        db.runs.clear(),
        db.photos.clear(),
        db.measurements.clear(),
        db.meta.clear(),
      ])
      await db.exercises.bulkPut(b.exercises)
      await db.programs.bulkPut(b.programs)
      await db.workouts.bulkPut(b.workouts)
      await db.bodyWeights.bulkPut(b.bodyWeights)
      await db.meals.bulkPut(b.meals)
      await db.notes.bulkPut(b.notes)
      await db.recipes.bulkPut(b.recipes)
      await db.runs.bulkPut(b.runs)
      await db.photos.bulkPut(b.photos)
      await db.measurements.bulkPut(b.measurements)
      await db.meta.bulkPut(b.meta.filter((m) => !DEVICE_ONLY.includes(m.key)))
      await db.meta.bulkPut(kept)
      // Копия без отметки о стартовом наборе иначе получила бы его второй раз при запуске
      await db.meta.put({ key: 'seeded', value: true })
    },
  )
  return countBackup(b)
}

/** Удаляет все данные. При следующем запуске загрузится стартовый набор упражнений. */
export async function wipeAll(db: FitnessDB): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.exercises,
      db.programs,
      db.workouts,
      db.bodyWeights,
      db.meals,
      db.notes,
      db.recipes,
      db.runs,
      db.photos,
      db.measurements,
      db.meta,
    ],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.programs.clear(),
        db.workouts.clear(),
        db.bodyWeights.clear(),
        db.meals.clear(),
        db.notes.clear(),
        db.recipes.clear(),
        db.runs.clear(),
        db.photos.clear(),
        db.measurements.clear(),
        db.meta.clear(),
      ])
    },
  )
}

/** «fitnes-2026-09-25.json» */
export function backupFileName(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `fitnes-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}

/** Напоминать о копии, если есть тренировки, а последней копии нет или ей больше недели. */
export function backupIsDue(
  lastExportAt: number | null,
  workoutCount: number,
  now: number,
): boolean {
  if (workoutCount === 0) return false
  return lastExportAt === null || now - lastExportAt > 7 * 24 * 60 * 60 * 1000
}
