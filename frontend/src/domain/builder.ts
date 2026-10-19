// «Подобрать программу»: собирает программу по полу, возрасту, росту, весу, месту, опыту,
// цели и числу тренировок в неделю. Дни состоят из «слотов» — видов движения (присед, тяга,
// жим…); в каждый слот подбирается первое подходящее упражнение стартового набора с учётом
// инвентаря и ограничений. Программа потом правится в редакторе как любая другая.

import type { TemplateDay } from './templates'
import type { NutritionGoal, PlanItem, ProgramKind, Sex } from './types'

export type Place = 'gym' | 'home'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type BuilderKind = 'auto' | 'fullbody' | 'upperlower' | 'ppl' | 'split'

export interface BuilderInput {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  place: Place
  /** Что есть дома; в зале не учитывается. */
  dumbbells: boolean
  pullUpBar: boolean
  level: Level
  goal: NutritionGoal
  daysPerWeek: number
  kind: BuilderKind
}

export const BUILDER_DEFAULTS: BuilderInput = {
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  place: 'gym',
  dumbbells: true,
  pullUpBar: false,
  level: 'beginner',
  goal: 'maintain',
  daysPerWeek: 3,
  kind: 'auto',
}

export const BUILDER_LIMITS = {
  age: { min: 14, max: 90 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 250 },
  daysPerWeek: { min: 2, max: 6 },
} as const

export interface BuiltProgram {
  name: string
  kind: Exclude<ProgramKind, 'boxing' | 'custom'>
  days: TemplateDay[]
  /** Почему программа такая — показывается под предпросмотром. */
  notes: string[]
}

/** Инвентарь: штанга, гантели, тренажёр, блок, турник, ничего. */
type Gear = 'B' | 'D' | 'M' | 'C' | 'T' | 'N'

interface Candidate {
  id: string
  /** Чем можно выполнить — достаточно одного. */
  gear: Gear[]
  /** Нагрузка на позвоночник с пола — не для новичков и не после 50. */
  heavy?: boolean
  /** Прыжки и удары о пол — не при большом весе. */
  impact?: boolean
  /** Подтягивания собственным весом — не для новичков и не при большом весе. */
  hang?: boolean
  /** Рабочий вес на 8–10 повторов у среднего мужчины, доля от веса тела (у гантелей — одна). */
  k?: number
  lower?: boolean
}

const c = (id: string, gear: Gear[], extra: Omit<Candidate, 'id' | 'gear'> = {}): Candidate => ({
  id,
  gear,
  ...extra,
})

type Slot =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'hpush'
  | 'incline'
  | 'vpush'
  | 'hpull'
  | 'vpull'
  | 'lateral'
  | 'rear'
  | 'chest'
  | 'biceps'
  | 'triceps'
  | 'kneeflex'
  | 'quads'
  | 'calves'
  | 'glute'
  | 'core'
  | 'cardio'

/** Кандидаты по слотам — от лучшего к запасному. */
const SLOTS: Record<Slot, Candidate[]> = {
  squat: [
    c('squat', ['B'], { k: 0.8, lower: true }),
    c('leg-press', ['M'], { k: 1.5, lower: true }),
    c('hack-squat', ['M'], { k: 0.8, lower: true }),
    c('goblet-squat', ['D'], { k: 0.22, lower: true }),
    c('bulgarian-split-squat', ['D', 'N'], { k: 0.1, lower: true }),
    c('bodyweight-squat', ['N']),
  ],
  hinge: [
    c('deadlift', ['B'], { heavy: true, k: 1, lower: true }),
    c('romanian-deadlift', ['B', 'D'], { k: 0.6, lower: true }),
    c('hip-thrust', ['B'], { k: 0.8, lower: true }),
    c('glute-bridge', ['N']),
  ],
  lunge: [
    c('db-lunge', ['D'], { k: 0.12, lower: true }),
    c('bulgarian-split-squat', ['D', 'N'], { k: 0.1, lower: true }),
    c('walking-lunge', ['N']),
    c('step-up', ['N']),
  ],
  hpush: [
    c('bench-press', ['B'], { k: 0.65 }),
    c('db-bench-press', ['D'], { k: 0.22 }),
    c('chest-press-machine', ['M'], { k: 0.5 }),
    c('push-up', ['N']),
  ],
  incline: [
    c('incline-db-press', ['D'], { k: 0.18 }),
    c('incline-bench-press', ['B'], { k: 0.5 }),
    c('push-up', ['N']),
  ],
  vpush: [
    c('overhead-press', ['B'], { k: 0.4 }),
    c('seated-db-press', ['D'], { k: 0.15 }),
    c('machine-shoulder-press', ['M'], { k: 0.35 }),
    c('arnold-press', ['D'], { k: 0.12 }),
  ],
  hpull: [
    c('barbell-row', ['B'], { k: 0.55 }),
    c('seated-cable-row', ['C'], { k: 0.5 }),
    c('db-row', ['D'], { k: 0.25 }),
    c('inverted-row', ['T']),
  ],
  vpull: [
    c('pull-up', ['T'], { hang: true }),
    c('lat-pulldown', ['C'], { k: 0.55 }),
    c('chin-up', ['T'], { hang: true }),
    c('close-grip-pulldown', ['C'], { k: 0.5 }),
    c('inverted-row', ['T']),
    c('db-row', ['D'], { k: 0.25 }),
  ],
  lateral: [c('lateral-raise', ['D'], { k: 0.06 }), c('cable-lateral-raise', ['C'], { k: 0.04 })],
  rear: [c('face-pull', ['C'], { k: 0.2 }), c('rear-delt-fly', ['D'], { k: 0.05 })],
  chest: [
    c('cable-fly', ['C'], { k: 0.1 }),
    c('pec-deck', ['M'], { k: 0.35 }),
    c('db-fly', ['D'], { k: 0.1 }),
  ],
  biceps: [
    c('barbell-curl', ['B'], { k: 0.3 }),
    c('db-curl', ['D'], { k: 0.1 }),
    c('hammer-curl', ['D'], { k: 0.11 }),
    c('cable-curl', ['C'], { k: 0.2 }),
  ],
  triceps: [
    c('triceps-pushdown', ['C'], { k: 0.25 }),
    c('skull-crusher', ['B'], { k: 0.25 }),
    c('overhead-triceps', ['D'], { k: 0.15 }),
    c('bench-dips', ['N']),
  ],
  kneeflex: [
    c('leg-curl', ['M'], { k: 0.35, lower: true }),
    c('seated-leg-curl', ['M'], { k: 0.35, lower: true }),
  ],
  quads: [c('leg-extension', ['M'], { k: 0.4, lower: true })],
  calves: [c('calf-raise', ['M', 'D', 'N'], { lower: true })],
  glute: [
    c('hip-thrust', ['B'], { k: 0.8, lower: true }),
    c('hip-abduction', ['M'], { k: 0.4, lower: true }),
    c('cable-kickback', ['C'], { k: 0.08, lower: true }),
    c('glute-bridge', ['N']),
  ],
  core: [
    c('plank', ['N']),
    c('hanging-leg-raise', ['T'], { hang: true }),
    c('leg-raise', ['N']),
    c('crunch', ['N']),
    c('side-plank', ['N']),
  ],
  cardio: [
    c('exercise-bike', ['M']),
    c('elliptical', ['M']),
    c('rowing-machine', ['M']),
    c('jump-rope', ['N'], { impact: true }),
    c('shadow-boxing', ['N']),
  ],
}

/**
 * Добор, если в дне осталось меньше упражнений, чем нужно: дома без инвентаря
 * для спины и плеч подобрать нечего, и день «Верх» иначе выйдет из двух упражнений.
 */
const FILLER = [
  c('push-up', ['N']),
  c('bench-dips', ['N']),
  c('bodyweight-squat', ['N']),
  c('glute-bridge', ['N']),
  c('side-plank', ['N']),
  c('leg-raise', ['N']),
  c('hollow-hold', ['N']),
  c('burpee', ['N'], { impact: true }),
]
/** Меньше этого в дне не бывает (без кардио). */
const MIN_PER_DAY = 4

/**
 * Упражнения стартового набора на то же движение, что и `id` (без «builtin-»):
 * соседи по слотам подбора программы, от лучшего к запасному.
 */
export function slotMates(id: string): string[] {
  const out = new Set<string>()
  for (const list of Object.values(SLOTS))
    if (list.some((x) => x.id === id)) for (const x of list) if (x.id !== id) out.add(x.id)
  return [...out]
}

/** Упражнения на время: план — в секундах. */
const TIMED = new Set([
  'hollow-hold',
  'plank',
  'side-plank',
  'exercise-bike',
  'elliptical',
  'rowing-machine',
  'jump-rope',
  'shadow-boxing',
])

/** Слот дня: `main` — базовое упражнение в начале, `v` — взять другой вариант, чем в соседнем дне. */
interface DaySlot {
  slot: Slot
  main?: boolean
  v?: number
}

const s = (slot: Slot, v = 0): DaySlot => ({ slot, v })
const m = (slot: Slot, v = 0): DaySlot => ({ slot, main: true, v })

interface DayPlan {
  name: string
  slots: DaySlot[]
}

const FULLBODY: DayPlan[] = [
  {
    name: 'Фулбади A',
    slots: [m('squat'), m('hpush'), s('vpull'), s('hinge', 1), s('lateral'), s('core')],
  },
  {
    name: 'Фулбади B',
    slots: [
      m('hinge'),
      m('vpush'),
      s('hpull'),
      s('lunge'),
      s('biceps'),
      s('triceps'),
      s('core', 2),
    ],
  },
  {
    name: 'Фулбади C',
    slots: [m('squat', 1), m('incline'), s('vpull', 1), s('glute'), s('rear'), s('core', 1)],
  },
]

const UPPER_LOWER: DayPlan[] = [
  {
    name: 'Верх A',
    slots: [m('hpush'), m('hpull'), s('vpush'), s('vpull'), s('biceps'), s('triceps')],
  },
  {
    name: 'Низ A',
    slots: [m('squat'), s('hinge', 1), s('lunge'), s('kneeflex'), s('calves'), s('core')],
  },
  {
    name: 'Верх B',
    slots: [m('vpush'), m('vpull'), s('incline'), s('hpull', 1), s('lateral'), s('rear')],
  },
  {
    name: 'Низ B',
    slots: [m('hinge'), s('squat', 1), s('glute'), s('quads'), s('calves'), s('core', 2)],
  },
]

const PPL: DayPlan[] = [
  {
    name: 'Толкай',
    slots: [m('hpush'), m('vpush'), s('incline'), s('lateral'), s('triceps'), s('chest')],
  },
  {
    name: 'Тяни',
    slots: [m('vpull'), m('hpull'), s('rear'), s('biceps'), s('biceps', 2), s('hinge', 1)],
  },
  {
    name: 'Ноги',
    slots: [m('squat'), s('hinge', 1), s('lunge'), s('kneeflex'), s('calves'), s('core')],
  },
  {
    name: 'Толкай B',
    slots: [m('vpush'), m('incline'), s('hpush', 1), s('lateral'), s('triceps', 1), s('chest', 1)],
  },
  {
    name: 'Тяни B',
    slots: [m('hpull'), m('vpull', 1), s('rear', 1), s('biceps', 1), s('hinge'), s('core', 1)],
  },
  {
    name: 'Ноги B',
    slots: [m('hinge'), s('squat', 1), s('glute'), s('quads'), s('calves'), s('core', 2)],
  },
]

const SPLIT: Record<number, DayPlan[]> = {
  3: [
    {
      name: 'Грудь и трицепс',
      slots: [m('hpush'), s('incline'), s('chest'), s('triceps'), s('triceps', 1)],
    },
    {
      name: 'Спина и бицепс',
      slots: [m('vpull'), m('hpull'), s('hinge', 1), s('biceps'), s('biceps', 2)],
    },
    {
      name: 'Ноги и плечи',
      slots: [m('squat'), s('kneeflex'), s('vpush'), s('lateral'), s('calves'), s('core')],
    },
  ],
  4: [
    {
      name: 'Грудь и трицепс',
      slots: [m('hpush'), s('incline'), s('chest'), s('triceps'), s('triceps', 1)],
    },
    {
      name: 'Спина и бицепс',
      slots: [m('vpull'), m('hpull'), s('rear'), s('biceps'), s('biceps', 2)],
    },
    {
      name: 'Ноги',
      slots: [m('squat'), s('hinge', 1), s('lunge'), s('kneeflex'), s('calves'), s('core')],
    },
    {
      name: 'Плечи и пресс',
      slots: [m('vpush'), s('lateral'), s('rear', 1), s('vpush', 1), s('core', 1), s('core', 2)],
    },
  ],
  5: [
    { name: 'Грудь', slots: [m('hpush'), s('incline'), s('chest'), s('hpush', 1), s('triceps')] },
    { name: 'Спина', slots: [m('hinge'), m('vpull'), s('hpull'), s('hpull', 1), s('rear')] },
    {
      name: 'Ноги',
      slots: [m('squat'), s('hinge', 1), s('lunge'), s('kneeflex'), s('quads'), s('calves')],
    },
    { name: 'Плечи', slots: [m('vpush'), s('vpush', 1), s('lateral'), s('rear', 1), s('core')] },
    {
      name: 'Руки',
      slots: [s('biceps'), s('triceps'), s('biceps', 2), s('triceps', 1), s('core', 2)],
    },
  ],
}

const KIND_NAMES: Record<BuiltProgram['kind'], string> = {
  fullbody: 'Фулбади',
  upperlower: 'Верх / Низ',
  ppl: 'Тяни / Толкай / Ноги',
  split: 'Сплит',
}

/** Тип по числу тренировок и опыту, если выбрано «Подобрать». */
export function autoKind(days: number, level: Level): BuiltProgram['kind'] {
  if (days <= 3) return 'fullbody'
  if (days === 4 || level === 'beginner') return 'upperlower'
  return days === 5 ? 'split' : 'ppl'
}

function dayPlans(kind: BuiltProgram['kind'], days: number): DayPlan[] {
  switch (kind) {
    case 'fullbody':
      return FULLBODY.slice(0, Math.max(2, Math.min(3, days)))
    case 'upperlower':
      return UPPER_LOWER.slice(0, days >= 4 ? 4 : 2)
    case 'ppl':
      return PPL.slice(0, days >= 6 ? 6 : 3)
    case 'split':
      return SPLIT[Math.max(3, Math.min(5, days))]
  }
}

export const bmi = (weightKg: number, heightCm: number) => weightKg / (heightCm / 100) ** 2

interface Rules {
  gear: Set<Gear>
  has: (exerciseId: string) => boolean
  noHeavy: boolean
  noImpact: boolean
  noHang: boolean
}

function rules(i: BuilderInput, has: (exerciseId: string) => boolean): Rules {
  const gear = new Set<Gear>(['N'])
  if (i.place === 'gym') for (const g of ['B', 'D', 'M', 'C', 'T'] as const) gear.add(g)
  else {
    if (i.dumbbells) gear.add('D')
    if (i.pullUpBar) gear.add('T')
  }
  const heavyBody = bmi(i.weightKg, i.heightCm) >= 30
  return {
    gear,
    has,
    noHeavy: i.level === 'beginner' || i.age >= 50,
    noImpact: heavyBody || i.age >= 55,
    noHang: i.level === 'beginner' || heavyBody,
  }
}

function allowed(cand: Candidate, r: Rules): boolean {
  return (
    r.has(`builtin-${cand.id}`) &&
    cand.gear.some((g) => r.gear.has(g)) &&
    !(r.noHeavy && cand.heavy) &&
    !(r.noImpact && cand.impact) &&
    !(r.noHang && cand.hang)
  )
}

/** Сколько упражнений в дне: новичку меньше, опытному больше. */
const PER_DAY: Record<Level, number> = { beginner: 5, intermediate: 6, advanced: 7 }

/**
 * Подходы и повторы. Масса — тяжелее и реже, похудение — легче, чаще, с коротким отдыхом.
 * После 50 — не меньше 8 повторов и отдых на 30 с дольше.
 */
function scheme(i: BuilderInput, main: boolean): Omit<PlanItem, 'exerciseId' | 'weightKg'> {
  const table: Record<NutritionGoal, [number, number, number, number][]> = {
    // [подходы, от, до, отдых] — для базового и для вспомогательного
    gain: [
      [4, 6, 8, 150],
      [3, 10, 12, 90],
    ],
    maintain: [
      [3, 8, 10, 120],
      [3, 10, 12, 75],
    ],
    lose: [
      [3, 10, 12, 90],
      [3, 12, 15, 60],
    ],
  }
  let [sets, repsMin, repsMax, restSec] = table[i.goal][main ? 0 : 1]
  if (main && i.level === 'beginner' && i.goal === 'gain') [sets, repsMin, repsMax] = [3, 8, 10]
  if (main && i.level === 'advanced') sets += 1
  if (i.age >= 50) {
    repsMin = Math.max(repsMin, 8)
    repsMax = Math.max(repsMax, repsMin + 2)
    restSec += 30
  }
  return { sets, repsMin, repsMax, restSec }
}

function timedScheme(i: BuilderInput, id: string): Omit<PlanItem, 'exerciseId' | 'weightKg'> {
  if (SLOTS.cardio.some((x) => x.id === id)) {
    const min = i.level === 'beginner' ? 10 : 15
    return { sets: 1, repsMin: min * 60, repsMax: (min + 5) * 60, restSec: 0 }
  }
  return i.level === 'beginner'
    ? { sets: 3, repsMin: 20, repsMax: 40, restSec: 60 }
    : { sets: 3, repsMin: 30, repsMax: 60, restSec: 60 }
}

/**
 * Вес, от которого считаются стартовые веса: при ИМТ выше 25 лишнее учитывается на треть —
 * сила растёт с мышцами, а не с жиром.
 */
export function strengthBase(weightKg: number, heightCm: number): number {
  const lean = 25 * (heightCm / 100) ** 2
  return weightKg <= lean ? weightKg : lean + (weightKg - lean) / 3
}

const LEVEL_K: Record<Level, number> = { beginner: 0.6, intermediate: 1, advanced: 1.25 }

/** Примерный стартовый вес: доля веса тела с поправкой на опыт, пол, возраст и цель. */
function startWeight(cand: Candidate, i: BuilderInput, gear: Set<Gear>): number {
  if (!cand.k) return 0
  let kg = cand.k * strengthBase(i.weightKg, i.heightCm) * LEVEL_K[i.level]
  if (i.sex === 'female') kg *= cand.lower ? 0.75 : 0.55
  if (i.age >= 60) kg *= 0.75
  else if (i.age >= 50) kg *= 0.85
  if (i.goal === 'lose') kg *= 0.85
  const g = cand.gear.find((x) => gear.has(x))
  if (!g || g === 'N') return 0
  if (g === 'B') return Math.max(20, Math.round(kg / 2.5) * 2.5)
  if (g === 'D') return Math.max(2, Math.round(kg))
  return Math.max(5, Math.round(kg / 2.5) * 2.5)
}

/**
 * Собирает программу. `variant` — «другой вариант»: сдвигает выбор в каждом слоте,
 * чтобы при том же наборе параметров получились другие упражнения.
 */
export function buildProgram(
  input: BuilderInput,
  variant = 0,
  /** Есть ли упражнение у пользователя: удалённые из справочника не подбираются. */
  has: (exerciseId: string) => boolean = () => true,
): BuiltProgram {
  const kind = input.kind === 'auto' ? autoKind(input.daysPerWeek, input.level) : input.kind
  const r = rules(input, has)
  const limit = PER_DAY[input.level]

  const days = dayPlans(kind, input.daysPerWeek).map((plan) => {
    const used = new Set<string>()
    let picks: { cand: Candidate; main: boolean; slot: Slot }[] = []
    for (const { slot, main = false, v = 0 } of plan.slots) {
      const options = SLOTS[slot].filter((x) => allowed(x, r) && !used.has(x.id))
      if (!options.length) continue
      // базовые упражнения не меняются «другим вариантом» — лучшее остаётся лучшим
      const cand = options[(v + (main ? 0 : variant)) % options.length]
      used.add(cand.id)
      picks.push({ cand, main, slot })
    }
    // лишнее срезается с конца, но пресс остаётся последним
    if (picks.length > limit) {
      const core = picks.findLast((p) => p.slot === 'core')
      picks = picks.filter((p) => p !== core).slice(0, core ? limit - 1 : limit)
      if (core) picks.push(core)
    }
    for (const cand of FILLER) {
      if (picks.length >= MIN_PER_DAY) break
      if (!allowed(cand, r) || used.has(cand.id)) continue
      used.add(cand.id)
      picks.push({ cand, main: false, slot: 'core' })
    }
    // похудение: в конце дня — кардио
    if (input.goal === 'lose') {
      const cardio = SLOTS.cardio.find((x) => allowed(x, r))
      if (cardio) picks.push({ cand: cardio, main: false, slot: 'cardio' })
    }
    return {
      name: plan.name,
      items: picks.map(({ cand, main }) => ({
        exerciseId: `builtin-${cand.id}`,
        ...(TIMED.has(cand.id) ? timedScheme(input, cand.id) : scheme(input, main)),
        weightKg: startWeight(cand, input, r.gear),
      })),
    }
  })

  return { name: `${KIND_NAMES[kind]} — под меня`, kind, days, notes: notes(input, kind, r) }
}

function notes(i: BuilderInput, kind: BuiltProgram['kind'], r: Rules): string[] {
  const out: string[] = []
  const per = `${i.daysPerWeek} ${i.daysPerWeek < 5 ? 'раза' : 'раз'} в неделю`
  out.push(
    {
      fullbody: `Фулбади, ${per}: всё тело за тренировку — каждая мышца работает часто, а восстановиться успевает.`,
      upperlower: `Верх / Низ, ${per}: верх и низ тела по очереди — больше упражнений на группу без долгих тренировок.`,
      ppl: `Тяни / Толкай / Ноги, ${per}: жимы, тяги и ноги в разные дни — для тех, кто тренируется часто.`,
      split: `Сплит, ${per}: каждый день — свои группы мышц, большой объём на каждую.`,
    }[kind],
  )
  out.push(
    {
      gain: 'Цель — масса: базовые упражнения тяжело на 6–10 повторов, отдых 1,5–2,5 минуты.',
      maintain: 'Цель — форма и сила: умеренный вес на 8–12 повторов.',
      lose: 'Цель — похудеть: больше повторов, короче отдых и 10–20 минут кардио в конце.',
    }[i.goal],
  )
  if (i.place === 'home') {
    const has = [i.dumbbells && 'гантели', i.pullUpBar && 'турник'].filter(Boolean)
    out.push(
      has.length
        ? `Дома: упражнения с собственным весом, плюс ${has.join(' и ')}. В «Румынской тяге» и «Выпадах» — гантели.`
        : 'Дома без инвентаря: только собственный вес. Спину без турника почти нечем нагрузить — турник в дверной проём сильно расширит программу.',
    )
  }
  const index = bmi(i.weightKg, i.heightCm)
  if (index >= 30)
    out.push(
      `ИМТ ${Math.round(index)}: без прыжков, вместо подтягиваний — ${i.place === 'gym' ? 'тяга блока' : 'тяги'}, кардио без ударной нагрузки.`,
    )
  else if (r.noHang && i.place === 'gym')
    out.push('Для начала — тяга верхнего блока вместо подтягиваний: так проще дозировать вес.')
  else if (r.noHang && i.pullUpBar)
    out.push('Для начала — австралийские подтягивания на низком турнике: обычные придут позже.')
  if (i.age >= 50)
    out.push('После 50: без становой тяги с пола, не меньше 8 повторов, отдых дольше.')
  else if (i.level === 'beginner')
    out.push('Новичку — без становой тяги с пола: сначала техника на румынской тяге.')
  if (i.sex === 'female')
    out.push('Стартовые веса посчитаны с учётом пола: верх тела легче, ноги — ближе к мужским.')
  out.push(
    'Стартовые веса примерные: на первой тренировке подберите такой, чтобы последние 2 повтора давались тяжело.',
  )
  return out
}
