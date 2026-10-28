// Модель данных приложения (ТЗ, раздел 3; архитектура, раздел 7.3).

import type { AiMessage } from './ai'
import type { BuilderInput } from './builder'
import type { DeloadWeek } from './deload'
import type { IntervalConfig, IntervalMode } from './interval'

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
  /** Суперсет: соседние упражнения с одной меткой — по кругу без отдыха между ними. */
  superset?: string | null
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
  /** Разминочный подход: не идёт в рекорды, тоннаж и подсказку прогрессии. */
  warmup?: boolean
}

/** Упражнение в тренировке: фактические подходы и копия плана на момент старта. */
export interface WorkoutEntry {
  exerciseId: ID
  restSec: number
  plan: Omit<PlanItem, 'exerciseId' | 'restSec' | 'superset'> | null
  sets: WorkoutSet[]
  /** Суперсет — как в дне программы. Нет в записях до версии 1.3. */
  superset?: string | null
  /** Заметка к упражнению: настройка тренажёра, хват, ощущения. */
  note?: string
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

/** Замеры тела, см (этап 22.3). */
/** Порядок — как в форме и списке; новые замеры (плечи, живот) дописаны в конец, чтобы не сдвигать старые. */
export const MEASURE_KEYS = [
  'waist',
  'chest',
  'hips',
  'thigh',
  'biceps',
  'shoulders',
  'belly',
] as const
export type MeasureKey = (typeof MEASURE_KEYS)[number]

/** Замеры сверху вниз — как точки на фигуре в «Прогресс» → «Тело». */
export const FIGURE_ORDER: MeasureKey[] = [
  'shoulders',
  'chest',
  'biceps',
  'waist',
  'belly',
  'hips',
  'thigh',
]

export const MEASURE_LABELS: Record<MeasureKey, string> = {
  waist: 'Талия',
  chest: 'Грудь',
  hips: 'Бёдра',
  thigh: 'Бедро',
  biceps: 'Бицепс',
  shoulders: 'Плечи',
  belly: 'Живот',
}

/** Замеры за день: одна запись на дату, незаполненные замеры отсутствуют. */
export interface Measurement extends Syncable {
  date: ISODate
  values: Partial<Record<MeasureKey, number>>
}

/**
 * Фото прогресса (этап 21.11): снимок тела за день. Картинки — JPEG в data URL:
 * так они без перевода попадают в резервную копию. На одну дату может быть несколько снимков.
 */
export interface ProgressPhoto extends Syncable {
  date: ISODate
  /** Снимок, уменьшенный до 1280 px по длинной стороне. */
  image: string
  /** Миниатюра для сетки, до 360 px. */
  thumb: string
  createdAt: Timestamp
}

/** Калории и белки, жиры, углеводы. Калории в ккал, остальное в граммах. */
export interface Nutrients {
  calories: number
  protein: number
  fat: number
  carbs: number
}

/** Приём пищи (вкладка «Тело» → «Питание»). Значения — на всю порцию, а не на 100 г. */
/** Приём пищи в дневнике: плитки «Завтрак / Перекус / Обед / Ужин». */
export type MealSlot = 'breakfast' | 'snack' | 'lunch' | 'dinner'

export interface Meal extends Syncable, Nutrients {
  date: ISODate
  /** Какой приём пищи; у старых записей нет — берётся по времени добавления (domain/mealSlots). */
  slot?: MealSlot
  name: string
  /** Вес порции; null — не указан. По нему пересчитываются значения при повторе. */
  grams: number | null
  /** Когда добавлен: порядок внутри дня. */
  createdAt: Timestamp
}

export type Sex = 'male' | 'female'
/** Пять уровней активности, от сидячего образа жизни до тяжёлой работы и тренировок каждый день. */
export type Activity = 'none' | 'light' | 'moderate' | 'high' | 'extreme'
export type NutritionGoal = 'lose' | 'maintain' | 'gain'

/** Параметры для расчёта плана питания. Вес берётся из записей веса, здесь не хранится. */
export interface BodyProfile {
  sex: Sex
  age: number
  heightCm: number
  activity: Activity
  goal: NutritionGoal
  /** Целевой вес, кг; от него считается белок на сушке. Необязателен. */
  targetKg?: number
}

/** Продукт, найденный по штрихкоду. */
export interface BarcodeFood {
  code: string
  name: string
  /** КБЖУ на 100 г. */
  per100: Nutrients
  /** Вес порции с упаковки, г; null — не указан. */
  servingG: number | null
}

/** С чего посчитан текущий план питания — чтобы подсказать пересчёт и поправку по весу. */
export interface PlanBasis {
  /** Когда план задан или поправлен. */
  setAt?: ISODate
  /** Вес на момент расчёта; нет — план введён вручную. */
  weightKg?: number
  /** До какого дня не предлагать поправку («Не сейчас»). */
  snoozedUntil?: ISODate
}

/** Записи таблицы meta: настройки и служебные указатели. */
export interface MetaValues {
  schemaVersion: number
  seeded: boolean
  /** Какая версия стартового набора упражнений уже загружена. */
  seedVersion: number
  weightStepKg: number
  /** Цель недели для серии на «Сегодня», тренировок; null — по числу дней активной программы. */
  weekGoal: number | null
  /** Вес грифа в калькуляторе блинов, кг; 0 — без грифа. */
  barKg: number
  activeProgramId: ID | null
  /** Индекс следующего дня для каждой программы. */
  nextDayIndex: Record<ID, number>
  /** Когда последний раз сохранялась резервная копия; null — ни разу. */
  lastExportAt: Timestamp | null
  /** Дневной план питания; null — не задан. */
  nutritionPlan: Nutrients | null
  /** Пол, возраст, рост, активность и цель для расчёта плана; null — не вводились. */
  bodyProfile: BodyProfile | null
  /** С какого веса и когда задан план; null — плана нет или он из старой версии. */
  planBasis: PlanBasis | null
  /** Последние ответы в «Подобрать программу»; null — ещё не подбирали. */
  builderInput: BuilderInput | null
  /** Любимые рецепты — id встроенных и своих, в порядке добавления. */
  favoriteRecipes: ID[]
  /** Переписка с помощником, последние сообщения. */
  aiChat: AiMessage[]
  /** Отправлять ли помощнику сводку своих данных: тренировки, вес, питание. */
  aiUseContext: boolean
  /** Голосом на каждом километре пробежки: «1 километр, темп 5:30». */
  runVoice: boolean
  /** Интервальный таймер: последний режим и настройки каждого; null — ещё не запускали. */
  /** Знакомство при первом запуске пройдено или пропущено. */
  onboarded: boolean
  /** Последняя или идущая неделя разгрузки; null — ещё не было. */
  deload: DeloadWeek | null
  /** До какого дня не предлагать разгрузку («Не сейчас»). */
  deloadSnoozedUntil: ISODate | null
  intervalTimer: { mode: IntervalMode; configs: Record<IntervalMode, IntervalConfig> } | null
  /** Вода и сон по дням (дневник питания); дни без записей отсутствуют. */
  dayTrackers: Record<ISODate, DayTracker>
  /** Шаги по дням, сохранённые из Health Connect: там хранится только 30 дней. */
  stepsHistory: Record<ISODate, number>
  /** Продукты, уже найденные по штрихкоду: второй раз — без интернета. */
  barcodeFoods: Record<string, BarcodeFood>
}

/** Вода и сон за день. */
export interface DayTracker {
  waterMl?: number
  sleepMin?: number
}

export type MetaKey = keyof MetaValues

export interface MetaRecord<K extends MetaKey = MetaKey> {
  key: K
  value: MetaValues[K]
}

/** Заметка: свободный текст пользователя. Заголовок необязателен — без него показывается первая строка. */
export interface Note extends Syncable {
  title: string
  text: string
  createdAt: Timestamp
}

/** Ингредиент своего блюда. КБЖУ на 100 г хранятся в нём: продукт мог быть своим, не из справочника. */
export interface RecipeIngredient {
  name: string
  grams: number
  per100: Nutrients
}

/** Своё блюдо пользователя. Все значения — на одну порцию, как у встроенных рецептов. */
export interface CustomRecipe extends Syncable {
  title: string
  minutes: number
  ingredients: RecipeIngredient[]
  steps: string[]
  createdAt: Timestamp
}
