// Модель данных приложения (ТЗ, раздел 3; архитектура, раздел 7.3).

export type ID = string

/** Дата без времени в локальной зоне: `YYYY-MM-DD`. */
export type ISODate = string

/** Метка времени в миллисекундах (Date.now()). */
export type Timestamp = number

/**
 * Общие поля всех сохраняемых сущностей. UUID, `updatedAt` и мягкое удаление
 * заложены с первой версии, чтобы синхронизацию можно было добавить без миграции данных.
 */
export interface Syncable {
  id: ID
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
  'boxing',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  legs: 'Ноги',
  shoulders: 'Плечи',
  arms: 'Руки',
  core: 'Пресс',
  cardio: 'Кардио',
  boxing: 'Бокс',
}

/**
 * - `weight` — вес × повторения;
 * - `bodyweight` — собственный вес, `weightKg` означает дополнительный вес;
 * - `time` — упражнение на время, результат в `timeSec`.
 */
export type ExerciseType = 'weight' | 'bodyweight' | 'time'

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight: 'Вес × повторения',
  bodyweight: 'Собственный вес',
  time: 'Время',
}

export interface Exercise extends Syncable {
  name: string
  muscle: MuscleGroup
  type: ExerciseType
  note: string
  /** Упражнение из стартового набора. */
  builtin: boolean
}

/** Упражнение в дне программы: что планируется сделать. */
export interface PlanItem {
  exerciseId: ID
  sets: number
  /** Для упражнений на время — секунды. */
  repsMin: number
  repsMax: number
  weightKg: number
  restSec: number
}

export interface ProgramDay {
  id: ID
  name: string
  items: PlanItem[]
}

/** Тип программы: как распределены группы мышц по дням. */
export type ProgramKind = 'fullbody' | 'upperlower' | 'ppl' | 'split' | 'boxing' | 'custom'

export interface Program extends Syncable {
  name: string
  days: ProgramDay[]
  /** Необязательное: у программ, созданных до появления типов, его нет — считаются «своими». */
  kind?: ProgramKind
}

export interface WorkoutSet {
  weightKg: number
  reps: number
  /** Только для упражнений типа `time`. */
  timeSec?: number
  done: boolean
}

/** Упражнение в тренировке: фактические подходы и копия плана на момент старта. */
export interface WorkoutEntry {
  exerciseId: ID
  restSec: number
  plan: Omit<PlanItem, 'exerciseId' | 'restSec'> | null
  sets: WorkoutSet[]
}

/**
 * `status` вместо проверки `finishedAt === null`: IndexedDB не индексирует null,
 * а активную тренировку нужно находить по индексу.
 * `planned` — тренировка на будущую дату (ТЗ 9.3): в свой день её предлагает «Сегодня».
 */
export type WorkoutStatus = 'planned' | 'active' | 'done'

export interface Workout extends Syncable {
  date: ISODate
  name: string
  programId: ID | null
  dayId: ID | null
  status: WorkoutStatus
  startedAt: Timestamp
  finishedAt: Timestamp | null
  note: string
  entries: WorkoutEntry[]
  /** Дублирует exerciseId из entries для мульти-индекса `*exerciseIds`. */
  exerciseIds: ID[]
  /**
   * Когда закончится текущий отдых. Хранится метка времени, а не остаток секунд:
   * таймер остаётся верным после сворачивания, блокировки экрана и перезагрузки.
   * Необязательное поле: в записях этапа 1 его нет, миграция не нужна.
   */
  restEndsAt?: Timestamp | null
  /** Полная длительность текущего отдыха, для полосы прогресса. */
  restTotalSec?: number
  /** Внесена вручную из «Истории»: реальной длительности у неё нет. */
  manual?: boolean
}

/**
 * Когда взвешивались (ТЗ 9.2): утром вес записывается как есть,
 * днём, вечером или после тренировки — с поправкой −1,5 кг.
 */
export type WeighTime = 'morning' | 'later'

/** Вес тела за день (ТЗ 2.5, п. 4; 9.2). Одна запись на дату. */
export interface BodyWeight extends Syncable {
  date: ISODate
  /** Итоговый вес — его показывают график и изменения. */
  weightKg: number
  /** Что показали весы. В записях до версии 1.1 поля нет: там итоговый = введённому. */
  measuredKg?: number
  /** Нет в записях до версии 1.1 — считаются утренними. */
  timeOfDay?: WeighTime
}

/** Записи таблицы meta: настройки и служебные указатели. */
export interface MetaValues {
  schemaVersion: number
  seeded: boolean
  /** Какая версия стартового набора упражнений уже загружена. */
  seedVersion: number
  weightStepKg: number
  activeProgramId: ID | null
  /** Индекс следующего дня для каждой программы. */
  nextDayIndex: Record<ID, number>
  /** Когда последний раз сохранялась резервная копия; null — ни разу. */
  lastExportAt: Timestamp | null
}

export type MetaKey = keyof MetaValues

export interface MetaRecord<K extends MetaKey = MetaKey> {
  key: K
  value: MetaValues[K]
}
