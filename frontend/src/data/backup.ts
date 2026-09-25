// Резервная копия всех данных в одном JSON-файле (ТЗ, раздел 5; архитектура, решение 6).
// Копия содержит всё, включая удалённые записи: так её можно восстановить без потерь.

import type { BodyWeight, Exercise, MetaRecord, Program, Workout } from '../domain/types'
import { SCHEMA_VERSION, type FitnessDB } from './db'

export const BACKUP_APP = 'fitnes'
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
    [db.exercises, db.programs, db.workouts, db.bodyWeights, db.meta],
    async () => ({
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date(now).toISOString(),
      exercises: await db.exercises.toArray(),
      programs: await db.programs.toArray(),
      workouts: await db.workouts.toArray(),
      bodyWeights: await db.bodyWeights.toArray(),
      // Время последней копии — свойство устройства, а не данных: в файл не попадает
      meta: (await db.meta.toArray()).filter((m) => m.key !== 'lastExportAt'),
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
  for (const key of ['exercises', 'programs', 'workouts', 'bodyWeights'] as const) {
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

/** Перевод старых копий в текущий формат: в копиях до веса тела нет списка bodyWeights. */
function migrate(data: Record<string, unknown>): Backup {
  const bodyWeights = Array.isArray(data.bodyWeights) ? data.bodyWeights : []
  return { ...data, bodyWeights } as unknown as Backup
}

/**
 * Заменяет все данные на копию. Всё в одной транзакции: при ошибке база остаётся прежней.
 * Незавершённая тренировка на этом устройстве пропадает вместе с остальными данными.
 */
export async function restoreBackup(db: FitnessDB, b: Backup): Promise<BackupCounts> {
  await db.transaction(
    'rw',
    [db.exercises, db.programs, db.workouts, db.bodyWeights, db.meta],
    async () => {
      const lastExportAt = await db.meta.get('lastExportAt')
      await Promise.all([
        db.exercises.clear(),
        db.programs.clear(),
        db.workouts.clear(),
        db.bodyWeights.clear(),
        db.meta.clear(),
      ])
      await db.exercises.bulkPut(b.exercises)
      await db.programs.bulkPut(b.programs)
      await db.workouts.bulkPut(b.workouts)
      await db.bodyWeights.bulkPut(b.bodyWeights)
      await db.meta.bulkPut(b.meta.filter((m) => m.key !== 'lastExportAt'))
      if (lastExportAt) await db.meta.put(lastExportAt)
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
    [db.exercises, db.programs, db.workouts, db.bodyWeights, db.meta],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.programs.clear(),
        db.workouts.clear(),
        db.bodyWeights.clear(),
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
