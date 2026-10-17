// Какие мышцы работают в упражнении — для схемы тела в карточке. Схема — рисунок
// Termininja с Викисклада (CC BY-SA 3.0), слои мышц — из проекта wger; файлы в
// `public/technique/muscles/`: `front.webp`, `back.webp`, `main-<n>.svg`, `secondary-<n>.svg`.

import type { Exercise } from './types'

/** Мышца на схеме → номер слоя wger и на какой стороне тела её видно. */
const LAYERS = {
  chest: { n: 4, sides: ['front'] },
  /** Дельты целиком: видны и спереди, и сзади. */
  delts: { n: 2, sides: ['front', 'back'] },
  frontDelts: { n: 2, sides: ['front'] },
  rearDelts: { n: 2, sides: ['back'] },
  biceps: { n: 1, sides: ['front'] },
  brachialis: { n: 13, sides: ['front'] },
  triceps: { n: 5, sides: ['back'] },
  abs: { n: 6, sides: ['front'] },
  obliques: { n: 14, sides: ['front'] },
  serratus: { n: 3, sides: ['front'] },
  quads: { n: 10, sides: ['front'] },
  hamstrings: { n: 11, sides: ['back'] },
  glutes: { n: 8, sides: ['back'] },
  calves: { n: 7, sides: ['back'] },
  traps: { n: 9, sides: ['back'] },
  lats: { n: 12, sides: ['back'] },
  lowerBack: { n: 16, sides: ['back'] },
} as const

export type MuscleKey = keyof typeof LAYERS
export type BodySide = 'front' | 'back'

/** [основные, вспомогательные]. Предплечий и приводящих на схеме нет — у таких упражнений её нет. */
type Work = [main: MuscleKey[], secondary: MuscleKey[]]

const PRESS: Work = [['chest'], ['frontDelts', 'triceps']]
const ROW: Work = [
  ['lats', 'traps'],
  ['biceps', 'rearDelts'],
]
const PULL_UP: Work = [['lats'], ['biceps', 'brachialis', 'traps']]
const SQUAT: Work = [
  ['quads', 'glutes'],
  ['hamstrings', 'lowerBack'],
]
const LUNGE: Work = [
  ['quads', 'glutes'],
  ['hamstrings', 'calves'],
]
const CURL: Work = [['biceps'], ['brachialis']]
const TRICEPS: Work = [['triceps'], []]
const PUNCH: Work = [
  ['delts', 'obliques'],
  ['triceps', 'chest', 'abs', 'calves'],
]

const WORK: Record<string, Work> = {
  'bench-press': PRESS,
  'incline-bench-press': PRESS,
  'decline-bench-press': PRESS,
  'db-bench-press': PRESS,
  'incline-db-press': PRESS,
  'smith-bench-press': PRESS,
  'chest-press-machine': PRESS,
  dips: [['chest', 'triceps'], ['frontDelts']],
  'push-up': [['chest'], ['frontDelts', 'triceps', 'abs']],
  'cable-fly': [['chest'], ['frontDelts']],
  'pec-deck': [['chest'], ['frontDelts']],
  'db-fly': [['chest'], ['frontDelts']],
  'incline-db-fly': [['chest'], ['frontDelts']],
  'db-pullover': [
    ['chest', 'lats'],
    ['triceps', 'serratus'],
  ],
  deadlift: [
    ['lowerBack', 'glutes', 'hamstrings'],
    ['quads', 'traps', 'lats'],
  ],
  'rack-pull': [
    ['lowerBack', 'traps'],
    ['glutes', 'hamstrings'],
  ],
  'barbell-row': ROW,
  't-bar-row': ROW,
  'db-row': ROW,
  'seated-cable-row': ROW,
  'machine-row': ROW,
  'pull-up': PULL_UP,
  'chin-up': [
    ['lats', 'biceps'],
    ['brachialis', 'traps'],
  ],
  'assisted-pull-up': PULL_UP,
  'inverted-row': ROW,
  'lat-pulldown': PULL_UP,
  'close-grip-pulldown': PULL_UP,
  'straight-arm-pulldown': [['lats'], ['triceps', 'rearDelts']],
  hyperextension: [['lowerBack', 'glutes'], ['hamstrings']],
  shrug: [['traps'], []],
  'db-shrug': [['traps'], []],
  squat: SQUAT,
  'front-squat': [['quads'], ['glutes', 'abs', 'lowerBack']],
  'smith-squat': SQUAT,
  'hack-squat': [['quads'], ['glutes', 'hamstrings']],
  'goblet-squat': [['quads', 'glutes'], ['abs']],
  'bodyweight-squat': [['quads', 'glutes'], ['hamstrings']],
  'leg-press': [['quads', 'glutes'], ['hamstrings']],
  'romanian-deadlift': [['hamstrings', 'glutes'], ['lowerBack']],
  'sumo-deadlift': [
    ['glutes', 'quads', 'hamstrings'],
    ['lowerBack', 'traps'],
  ],
  'db-lunge': LUNGE,
  'walking-lunge': LUNGE,
  'bulgarian-split-squat': LUNGE,
  'step-up': [
    ['quads', 'glutes'],
    ['hamstrings', 'calves'],
  ],
  'leg-extension': [['quads'], []],
  'leg-curl': [['hamstrings'], ['calves']],
  'seated-leg-curl': [['hamstrings'], ['calves']],
  'hip-thrust': [['glutes'], ['hamstrings', 'quads']],
  'glute-bridge': [['glutes'], ['hamstrings']],
  'cable-kickback': [['glutes'], ['hamstrings']],
  'hip-abduction': [['glutes'], []],
  'kettlebell-swing': [
    ['glutes', 'hamstrings'],
    ['lowerBack', 'frontDelts', 'abs'],
  ],
  'calf-raise': [['calves'], []],
  'seated-calf-raise': [['calves'], []],
  'overhead-press': [['frontDelts'], ['triceps', 'traps', 'abs']],
  'seated-db-press': [['frontDelts'], ['triceps', 'traps']],
  'arnold-press': [['delts'], ['triceps']],
  'machine-shoulder-press': [['frontDelts'], ['triceps']],
  'lateral-raise': [['delts'], ['traps']],
  'cable-lateral-raise': [['delts'], ['traps']],
  'front-raise': [['frontDelts'], ['chest']],
  'rear-delt-fly': [['rearDelts'], ['traps']],
  'reverse-pec-deck': [['rearDelts'], ['traps']],
  'face-pull': [['rearDelts'], ['traps']],
  'upright-row': [['delts', 'traps'], ['biceps']],
  'barbell-curl': CURL,
  'ez-curl': CURL,
  'db-curl': CURL,
  'hammer-curl': [['brachialis', 'biceps'], []],
  'preacher-curl': CURL,
  'cable-curl': CURL,
  'concentration-curl': CURL,
  'close-grip-bench': [['triceps'], ['chest', 'frontDelts']],
  'skull-crusher': TRICEPS,
  'overhead-triceps': TRICEPS,
  'triceps-pushdown': TRICEPS,
  'rope-pushdown': TRICEPS,
  'triceps-kickback': TRICEPS,
  'bench-dips': [['triceps'], ['chest', 'frontDelts']],
  plank: [['abs'], ['obliques', 'frontDelts']],
  'side-plank': [['obliques'], ['abs', 'delts']],
  'hollow-hold': [['abs'], ['obliques', 'quads']],
  crunch: [['abs'], ['obliques']],
  'cable-crunch': [['abs'], ['obliques']],
  'bicycle-crunch': [['obliques', 'abs'], []],
  'russian-twist': [['obliques'], ['abs']],
  'leg-raise': [['abs'], ['quads']],
  'hanging-leg-raise': [['abs'], ['obliques', 'lats']],
  'ab-wheel': [['abs'], ['lats', 'frontDelts']],
  treadmill: [
    ['quads', 'calves'],
    ['hamstrings', 'glutes'],
  ],
  'exercise-bike': [['quads'], ['calves', 'glutes', 'hamstrings']],
  elliptical: [
    ['quads', 'glutes'],
    ['hamstrings', 'calves'],
  ],
  'rowing-machine': [
    ['lats', 'quads'],
    ['biceps', 'lowerBack', 'glutes', 'hamstrings'],
  ],
  'stair-climber': [['quads', 'glutes'], ['calves']],
  'jump-rope': [['calves'], ['quads', 'delts']],
  burpee: [
    ['quads', 'chest'],
    ['frontDelts', 'triceps', 'abs', 'glutes'],
  ],
  'shadow-boxing': PUNCH,
  'db-shadow-boxing': [['delts'], ['triceps', 'obliques', 'traps']],
  'db-straight-punch': [
    ['frontDelts', 'triceps'],
    ['chest', 'obliques'],
  ],
  'db-hook': [
    ['delts', 'obliques'],
    ['chest', 'biceps'],
  ],
  'db-uppercut': [
    ['frontDelts', 'biceps'],
    ['obliques', 'quads'],
  ],
  'heavy-bag': PUNCH,
  mitts: PUNCH,
  'slip-drill': [
    ['obliques', 'quads'],
    ['abs', 'glutes', 'calves'],
  ],
  'med-ball-throw': [['chest'], ['frontDelts', 'triceps', 'abs']],
}

export const MUSCLE_NAMES: Record<MuscleKey, string> = {
  chest: 'грудь',
  delts: 'дельты',
  frontDelts: 'передние дельты',
  rearDelts: 'задние дельты',
  biceps: 'бицепс',
  brachialis: 'плечевая',
  triceps: 'трицепс',
  abs: 'пресс',
  obliques: 'косые мышцы',
  serratus: 'зубчатые',
  quads: 'квадрицепс',
  hamstrings: 'бицепс бедра',
  glutes: 'ягодицы',
  calves: 'икры',
  traps: 'трапеция',
  lats: 'широчайшие',
  lowerBack: 'поясница',
}

export interface MuscleWork {
  main: MuscleKey[]
  secondary: MuscleKey[]
  /** Слои для каждой стороны тела: сначала основные (красные), потом вспомогательные. */
  layers: Record<BodySide, string[]>
}

const slug = (exercise: Pick<Exercise, 'id'>) => exercise.id.replace(/^builtin-/, '')

/** Какие мышцы работают; null — для упражнения нет данных (свои, на предплечья, приводящие). */
export function muscleWork(exercise: Pick<Exercise, 'id'>): MuscleWork | null {
  const work = WORK[slug(exercise)]
  if (!work) return null
  const [main, secondary] = work
  const base = `${import.meta.env.BASE_URL}technique/muscles/`
  const layers: Record<BodySide, string[]> = { front: [], back: [] }
  for (const [list, kind] of [
    [main, 'main'],
    [secondary, 'secondary'],
  ] as const) {
    for (const key of list) {
      const { n, sides } = LAYERS[key]
      for (const side of sides) {
        const src = `${base}${kind}-${n}.svg`
        // одна и та же мышца могла попасть и в основные, и во вспомогательные через «дельты»
        if (!layers[side].some((l) => l.endsWith(`-${n}.svg`))) layers[side].push(src)
      }
    }
  }
  return { main, secondary, layers }
}

/** Фон схемы для стороны тела. */
export function bodyImage(side: BodySide): string {
  return `${import.meta.env.BASE_URL}technique/muscles/${side}.webp`
}
