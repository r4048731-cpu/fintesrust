// Готовые программы по типу тренировок: фулбади, верх/низ, тяни-толкай-ноги, сплит, бокс.
// Упражнения — из стартового набора (id вида builtin-…). Созданную программу можно править как любую.

import type { PlanItem, ProgramKind } from './types'

type Row = [exercise: string, sets: number, repsMin: number, repsMax: number, restSec: number]

export interface TemplateDay {
  name: string
  items: PlanItem[]
}

export interface ProgramTemplate {
  kind: ProgramKind
  name: string
  /** Кому и как часто — одна строка под названием. */
  summary: string
  days: TemplateDay[]
}

/** Базовые упражнения — 4 × 6–8 с отдыхом 2,5 мин, вспомогательные — 3 × 10–12 по 1,5 мин. */
const BASE = (id: string): Row => [id, 4, 6, 8, 150]
const ACC = (id: string): Row => [id, 3, 10, 12, 90]
const CORE_TIME = (id: string): Row => [id, 3, 30, 60, 60]
const CORE_REPS = (id: string): Row => [id, 3, 10, 15, 60]
/** Раунд по времени: `sets` раундов по `sec` секунд, отдых `rest` между раундами. */
const ROUND = (id: string, sets: number, sec: number, rest = 60): Row => [id, sets, sec, sec, rest]
/** Удары с лёгкими гантелями: 3 × 20–30 на каждую руку. */
const PUNCH = (id: string): Row => [id, 3, 20, 30, 60]

const day = (name: string, rows: Row[]): TemplateDay => ({
  name,
  items: rows.map(([id, sets, repsMin, repsMax, restSec]) => ({
    exerciseId: `builtin-${id}`,
    sets,
    repsMin,
    repsMax,
    weightKg: 0,
    restSec,
  })),
})

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    kind: 'fullbody',
    name: 'Фулбади',
    summary: 'Всё тело за тренировку, 2–3 раза в неделю. Хорошо для начала.',
    days: [
      day('Фулбади A', [
        BASE('squat'),
        BASE('bench-press'),
        BASE('barbell-row'),
        ACC('overhead-press'),
        CORE_TIME('plank'),
      ]),
      day('Фулбади B', [
        BASE('deadlift'),
        ACC('incline-db-press'),
        ACC('lat-pulldown'),
        ACC('db-lunge'),
        CORE_REPS('hanging-leg-raise'),
      ]),
    ],
  },
  {
    kind: 'upperlower',
    name: 'Верх / Низ',
    summary: 'Верх и низ тела по очереди, 4 раза в неделю.',
    days: [
      day('Верх', [
        BASE('bench-press'),
        BASE('barbell-row'),
        ACC('overhead-press'),
        ACC('lat-pulldown'),
        ACC('barbell-curl'),
        ACC('triceps-pushdown'),
      ]),
      day('Низ', [
        BASE('squat'),
        BASE('romanian-deadlift'),
        ACC('leg-press'),
        ACC('leg-curl'),
        ACC('calf-raise'),
        CORE_TIME('plank'),
      ]),
    ],
  },
  {
    kind: 'ppl',
    name: 'Тяни / Толкай / Ноги',
    summary: 'Три дня по кругу: жимы, тяги, ноги. 3–6 раз в неделю.',
    days: [
      day('Толкай', [
        BASE('bench-press'),
        BASE('overhead-press'),
        ACC('incline-db-press'),
        ACC('lateral-raise'),
        ACC('triceps-pushdown'),
      ]),
      day('Тяни', [
        BASE('deadlift'),
        ACC('pull-up'),
        ACC('barbell-row'),
        ACC('face-pull'),
        ACC('barbell-curl'),
        ACC('hammer-curl'),
      ]),
      day('Ноги', [
        BASE('squat'),
        BASE('romanian-deadlift'),
        ACC('leg-press'),
        ACC('leg-extension'),
        ACC('leg-curl'),
        ACC('calf-raise'),
      ]),
    ],
  },
  {
    kind: 'split',
    name: 'Сплит по группам мышц',
    summary: 'Каждый день — своя группа мышц, 5 раз в неделю.',
    days: [
      day('Грудь', [BASE('bench-press'), ACC('incline-db-press'), ACC('dips'), ACC('cable-fly')]),
      day('Спина', [BASE('deadlift'), ACC('pull-up'), ACC('barbell-row'), ACC('lat-pulldown')]),
      day('Ноги', [
        BASE('squat'),
        ACC('leg-press'),
        ACC('romanian-deadlift'),
        ACC('leg-curl'),
        ACC('calf-raise'),
      ]),
      day('Плечи', [
        BASE('overhead-press'),
        ACC('seated-db-press'),
        ACC('lateral-raise'),
        ACC('face-pull'),
      ]),
      day('Руки', [
        ACC('barbell-curl'),
        ACC('hammer-curl'),
        ACC('skull-crusher'),
        ACC('triceps-pushdown'),
        CORE_REPS('crunch'),
      ]),
    ],
  },
  {
    kind: 'boxing',
    name: 'Бокс',
    summary: 'Раунды по времени и удары с гантелями, 3 раза в неделю.',
    days: [
      day('Техника и удары', [
        ROUND('shadow-boxing', 3, 180),
        ROUND('heavy-bag', 4, 180),
        ROUND('mitts', 3, 180),
        ROUND('slip-drill', 3, 120),
        ROUND('jump-rope', 3, 180),
      ]),
      day('Сила для бокса', [
        PUNCH('db-straight-punch'),
        PUNCH('db-hook'),
        PUNCH('db-uppercut'),
        ROUND('db-shadow-boxing', 3, 120),
        ACC('med-ball-throw'),
        CORE_TIME('plank'),
      ]),
      day('Выносливость', [
        ROUND('jump-rope', 5, 180),
        ROUND('heavy-bag', 6, 120),
        CORE_REPS('burpee'),
        ROUND('db-shadow-boxing', 3, 120),
      ]),
    ],
  },
]

export const PROGRAM_KIND_LABELS: Record<ProgramKind, string> = {
  fullbody: 'Фулбади',
  upperlower: 'Верх / Низ',
  ppl: 'Тяни / Толкай / Ноги',
  split: 'Сплит',
  boxing: 'Бокс',
  custom: 'Своя',
}
