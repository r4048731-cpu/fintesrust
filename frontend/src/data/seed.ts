// Стартовый набор упражнений (ТЗ 2.1). Загружается при первом запуске, а когда набор
// пополняется — недостающие упражнения дозагружаются (см. SEED_VERSION).
// id постоянные, чтобы импорт резервной копии не создавал дубликаты.

import type { Exercise, ExerciseType, MuscleGroup } from '../domain/types'
import { SCHEMA_VERSION, type FitnessDB } from './db'
import { hasDuplicateName } from '../domain/exercises'
import { metaRepo } from './repositories/meta'

type SeedRow = [id: string, name: string, muscle: MuscleGroup, type?: ExerciseType]

const ROWS: SeedRow[] = [
  // Грудь
  ['bench-press', 'Жим штанги лёжа', 'chest'],
  ['incline-bench-press', 'Жим штанги на наклонной скамье', 'chest'],
  ['decline-bench-press', 'Жим штанги головой вниз', 'chest'],
  ['db-bench-press', 'Жим гантелей лёжа', 'chest'],
  ['incline-db-press', 'Жим гантелей на наклонной скамье', 'chest'],
  ['smith-bench-press', 'Жим лёжа в тренажёре Смита', 'chest'],
  ['chest-press-machine', 'Жим от груди в тренажёре', 'chest'],
  ['dips', 'Отжимания на брусьях', 'chest', 'bodyweight'],
  ['push-up', 'Отжимания от пола', 'chest', 'bodyweight'],
  ['cable-fly', 'Сведения рук в кроссовере', 'chest'],
  ['pec-deck', 'Бабочка (пек-дек)', 'chest'],
  ['db-fly', 'Разводка гантелей лёжа', 'chest'],
  ['incline-db-fly', 'Разводка гантелей на наклонной скамье', 'chest'],
  ['db-pullover', 'Пуловер с гантелью', 'chest'],

  // Спина
  ['deadlift', 'Становая тяга', 'back'],
  ['rack-pull', 'Тяга с плинтов', 'back'],
  ['barbell-row', 'Тяга штанги в наклоне', 'back'],
  ['t-bar-row', 'Тяга Т-грифа', 'back'],
  ['db-row', 'Тяга гантели одной рукой', 'back'],
  ['seated-cable-row', 'Тяга горизонтального блока', 'back'],
  ['machine-row', 'Тяга в рычажном тренажёре', 'back'],
  ['pull-up', 'Подтягивания', 'back', 'bodyweight'],
  ['chin-up', 'Подтягивания обратным хватом', 'back', 'bodyweight'],
  ['assisted-pull-up', 'Подтягивания в гравитроне', 'back'],
  ['inverted-row', 'Австралийские подтягивания', 'back', 'bodyweight'],
  ['lat-pulldown', 'Тяга верхнего блока', 'back'],
  ['close-grip-pulldown', 'Тяга верхнего блока узким хватом', 'back'],
  ['straight-arm-pulldown', 'Пуловер на верхнем блоке', 'back'],
  ['hyperextension', 'Гиперэкстензия', 'back', 'bodyweight'],
  ['shrug', 'Шраги со штангой', 'back'],
  ['db-shrug', 'Шраги с гантелями', 'back'],

  // Ноги и ягодицы
  ['squat', 'Приседания со штангой', 'legs'],
  ['front-squat', 'Фронтальные приседания', 'legs'],
  ['smith-squat', 'Приседания в тренажёре Смита', 'legs'],
  ['hack-squat', 'Гакк-приседания', 'legs'],
  ['goblet-squat', 'Гоблет-приседания', 'legs'],
  ['bodyweight-squat', 'Приседания без веса', 'legs', 'bodyweight'],
  ['leg-press', 'Жим ногами', 'legs'],
  ['romanian-deadlift', 'Румынская тяга', 'legs'],
  ['sumo-deadlift', 'Становая тяга сумо', 'legs'],
  ['db-lunge', 'Выпады с гантелями', 'legs'],
  ['walking-lunge', 'Выпады в ходьбе', 'legs'],
  ['bulgarian-split-squat', 'Болгарские выпады', 'legs'],
  ['step-up', 'Зашагивания на платформу', 'legs'],
  ['leg-extension', 'Разгибания ног в тренажёре', 'legs'],
  ['leg-curl', 'Сгибания ног в тренажёре', 'legs'],
  ['seated-leg-curl', 'Сгибания ног сидя', 'legs'],
  ['hip-thrust', 'Ягодичный мост со штангой', 'legs'],
  ['glute-bridge', 'Ягодичный мост', 'legs', 'bodyweight'],
  ['cable-kickback', 'Отведение ноги назад в кроссовере', 'legs'],
  ['hip-abduction', 'Разведение ног в тренажёре', 'legs'],
  ['hip-adduction', 'Сведение ног в тренажёре', 'legs'],
  ['kettlebell-swing', 'Махи гирей', 'legs'],
  ['calf-raise', 'Подъёмы на носки', 'legs'],
  ['seated-calf-raise', 'Подъёмы на носки сидя', 'legs'],

  // Плечи
  ['overhead-press', 'Жим штанги стоя', 'shoulders'],
  ['seated-db-press', 'Жим гантелей сидя', 'shoulders'],
  ['arnold-press', 'Жим Арнольда', 'shoulders'],
  ['machine-shoulder-press', 'Жим в тренажёре на плечи', 'shoulders'],
  ['lateral-raise', 'Махи гантелями в стороны', 'shoulders'],
  ['cable-lateral-raise', 'Махи в сторону на нижнем блоке', 'shoulders'],
  ['front-raise', 'Подъём гантелей перед собой', 'shoulders'],
  ['rear-delt-fly', 'Махи в наклоне на заднюю дельту', 'shoulders'],
  ['reverse-pec-deck', 'Обратная бабочка', 'shoulders'],
  ['face-pull', 'Тяга каната к лицу', 'shoulders'],
  ['upright-row', 'Тяга штанги к подбородку', 'shoulders'],

  // Руки
  ['barbell-curl', 'Подъём штанги на бицепс', 'arms'],
  ['ez-curl', 'Подъём EZ-штанги на бицепс', 'arms'],
  ['db-curl', 'Подъём гантелей на бицепс', 'arms'],
  ['hammer-curl', 'Молотки с гантелями', 'arms'],
  ['preacher-curl', 'Сгибания на скамье Скотта', 'arms'],
  ['cable-curl', 'Сгибания рук на нижнем блоке', 'arms'],
  ['concentration-curl', 'Концентрированные сгибания', 'arms'],
  ['close-grip-bench', 'Жим лёжа узким хватом', 'arms'],
  ['skull-crusher', 'Французский жим', 'arms'],
  ['overhead-triceps', 'Разгибания из-за головы с гантелью', 'arms'],
  ['triceps-pushdown', 'Разгибания рук на блоке', 'arms'],
  ['rope-pushdown', 'Разгибания с канатом на блоке', 'arms'],
  ['triceps-kickback', 'Разгибание руки с гантелью в наклоне', 'arms'],
  ['bench-dips', 'Обратные отжимания от скамьи', 'arms', 'bodyweight'],
  ['wrist-curl', 'Сгибания запястий', 'arms'],

  // Пресс
  ['plank', 'Планка', 'core', 'time'],
  ['side-plank', 'Боковая планка', 'core', 'time'],
  ['hollow-hold', 'Лодочка', 'core', 'time'],
  ['crunch', 'Скручивания', 'core', 'bodyweight'],
  ['cable-crunch', 'Скручивания на блоке', 'core'],
  ['bicycle-crunch', 'Велосипед', 'core', 'bodyweight'],
  ['russian-twist', 'Русские скручивания', 'core', 'bodyweight'],
  ['leg-raise', 'Подъём ног лёжа', 'core', 'bodyweight'],
  ['hanging-leg-raise', 'Подъём ног в висе', 'core', 'bodyweight'],
  ['ab-wheel', 'Ролик для пресса', 'core', 'bodyweight'],

  // Кардио
  ['treadmill', 'Беговая дорожка', 'cardio', 'time'],
  ['exercise-bike', 'Велотренажёр', 'cardio', 'time'],
  ['elliptical', 'Эллипсоид', 'cardio', 'time'],
  ['rowing-machine', 'Гребной тренажёр', 'cardio', 'time'],
  ['stair-climber', 'Степпер', 'cardio', 'time'],
  ['jump-rope', 'Скакалка', 'cardio', 'time'],
  ['burpee', 'Бёрпи', 'cardio', 'bodyweight'],
]

export function builtinExercises(now: number): Exercise[] {
  return ROWS.map(([id, name, muscle, type = 'weight']) => ({
    id: `builtin-${id}`,
    name,
    muscle,
    type,
    note: '',
    builtin: true,
    updatedAt: now,
    deletedAt: null,
  }))
}

/**
 * Версия стартового набора. Когда в ROWS появляются новые упражнения — поднять,
 * и у тех, кто уже пользуется приложением, недостающие упражнения добавятся при запуске.
 */
export const SEED_VERSION = 2

/**
 * Первый запуск — загружает весь стартовый набор. Дальше, если набор пополнился,
 * добавляет только новые упражнения: удалённые пользователем не возвращает (их запись
 * осталась с тем же id), и не создаёт дубль, если такое название уже есть среди его упражнений.
 * Возвращает true, если что-то добавил.
 */
export async function seedIfEmpty(db: FitnessDB, now = Date.now()): Promise<boolean> {
  const meta = metaRepo(db)
  return db.transaction('rw', db.exercises, db.meta, async () => {
    const seeded = await meta.get('seeded')
    if (seeded && (await meta.get('seedVersion')) >= SEED_VERSION) return false
    const all = builtinExercises(now)
    let added = all
    if (seeded) {
      const existing = await db.exercises.toArray()
      const ids = new Set(existing.map((e) => e.id))
      added = all.filter((e) => !ids.has(e.id) && !hasDuplicateName(existing, e.name))
    }
    if (added.length) await db.exercises.bulkPut(added)
    if (!seeded) await meta.set('schemaVersion', SCHEMA_VERSION)
    await meta.set('seeded', true)
    await meta.set('seedVersion', SEED_VERSION)
    return added.length > 0
  })
}
