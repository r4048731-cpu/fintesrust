import { describe, expect, it } from 'vitest'
import { builtinExercises } from '../src/data/seed'
import {
  autoKind,
  BUILDER_DEFAULTS,
  buildProgram,
  strengthBase,
  type BuilderInput,
} from '../src/domain/builder'

const base: BuilderInput = { ...BUILDER_DEFAULTS, weightKg: 80, heightCm: 180 }
const ids = (p: ReturnType<typeof buildProgram>) =>
  p.days.flatMap((d) => d.items.map((i) => i.exerciseId.replace('builtin-', '')))
const item = (p: ReturnType<typeof buildProgram>, id: string) =>
  p.days.flatMap((d) => d.items).find((i) => i.exerciseId === `builtin-${id}`)

describe('подбор программы', () => {
  it('любое сочетание параметров даёт программу из упражнений стартового набора', () => {
    const known = new Set(builtinExercises(0).map((e) => e.id))
    for (const place of ['gym', 'home'] as const)
      for (const dumbbells of [false, true])
        for (const pullUpBar of [false, true])
          for (const level of ['beginner', 'intermediate', 'advanced'] as const)
            for (const goal of ['lose', 'maintain', 'gain'] as const)
              for (const kind of ['auto', 'fullbody', 'upperlower', 'ppl', 'split'] as const)
                for (let daysPerWeek = 2; daysPerWeek <= 6; daysPerWeek++) {
                  const input = {
                    ...base,
                    place,
                    dumbbells,
                    pullUpBar,
                    level,
                    goal,
                    kind,
                    daysPerWeek,
                  }
                  for (const variant of [0, 1, 2]) {
                    const p = buildProgram(input, variant)
                    const label = JSON.stringify({ ...input, variant })
                    expect(p.days.length, label).toBeGreaterThanOrEqual(2)
                    for (const d of p.days) {
                      expect(d.items.length, `${label} ${d.name}`).toBeGreaterThanOrEqual(3)
                      const dayIds = d.items.map((i) => i.exerciseId)
                      expect(new Set(dayIds).size, `${label} ${d.name}`).toBe(dayIds.length)
                      for (const id of dayIds) expect(known.has(id), id).toBe(true)
                    }
                  }
                }
  })

  it('тип «авто» — по числу тренировок и опыту', () => {
    expect(autoKind(2, 'advanced')).toBe('fullbody')
    expect(autoKind(3, 'beginner')).toBe('fullbody')
    expect(autoKind(4, 'advanced')).toBe('upperlower')
    expect(autoKind(5, 'beginner')).toBe('upperlower')
    expect(autoKind(5, 'intermediate')).toBe('split')
    expect(autoKind(6, 'intermediate')).toBe('ppl')
    const p = buildProgram({ ...base, daysPerWeek: 4 })
    expect(p.kind).toBe('upperlower')
    expect(p.days.map((d) => d.name)).toEqual(['Верх A', 'Низ A', 'Верх B', 'Низ B'])
    expect(p.name).toBe('Верх / Низ — под меня')
  })

  it('дома без инвентаря — только собственный вес', () => {
    const p = buildProgram({ ...base, place: 'home', dumbbells: false, pullUpBar: false })
    const bodyweight = new Set(
      builtinExercises(0)
        .filter((e) => e.type !== 'weight')
        .map((e) => e.id.replace('builtin-', '')),
    )
    // «Подъёмы на носки» и «Болгарские выпады» по типу «вес», но делаются и без него
    const noWeight = new Set(['calf-raise', 'bulgarian-split-squat'])
    for (const id of ids(p)) expect(bodyweight.has(id) || noWeight.has(id), id).toBe(true)
    expect(p.days.flatMap((d) => d.items).every((i) => i.weightKg === 0)).toBe(true)
  })

  it('ограничения: новичок и 50+ без становой, большой вес без подтягиваний и прыжков', () => {
    const pro = { ...base, level: 'advanced' as const }
    expect(ids(buildProgram(pro))).toContain('deadlift')
    expect(ids(buildProgram(pro))).toContain('pull-up')
    expect(ids(buildProgram({ ...pro, level: 'beginner' }))).not.toContain('deadlift')
    expect(ids(buildProgram({ ...pro, age: 55 }))).not.toContain('deadlift')

    const heavy = { ...pro, weightKg: 115, goal: 'lose' as const }
    const p = buildProgram(heavy)
    expect(ids(p)).not.toContain('pull-up')
    expect(p.notes.join(' ')).toContain('ИМТ 35')
    const home = buildProgram({ ...heavy, place: 'home', dumbbells: false })
    expect(ids(home)).not.toContain('jump-rope')
  })

  it('цель меняет повторы и отдых; похудение — кардио в конце дня', () => {
    const gain = buildProgram({ ...base, level: 'intermediate', goal: 'gain' })
    expect(item(gain, 'squat')).toMatchObject({ sets: 4, repsMin: 6, repsMax: 8, restSec: 150 })
    const lose = buildProgram({ ...base, goal: 'lose' })
    expect(item(lose, 'squat')).toMatchObject({ sets: 3, repsMin: 10, repsMax: 12, restSec: 90 })
    for (const d of lose.days)
      expect(d.items.at(-1)).toMatchObject({
        exerciseId: 'builtin-exercise-bike',
        sets: 1,
        repsMin: 600,
      })
    const old = buildProgram({ ...base, level: 'intermediate', goal: 'gain', age: 60 })
    expect(item(old, 'squat')).toMatchObject({ repsMin: 8, restSec: 180 })
  })

  it('новичку меньше упражнений, опытному больше; пресс остаётся последним', () => {
    const count = (level: BuilderInput['level']) =>
      Math.max(
        ...buildProgram({ ...base, level, kind: 'fullbody' }).days.map((d) => d.items.length),
      )
    expect(count('beginner')).toBe(5)
    expect(count('advanced')).toBeGreaterThan(5)
    const b = buildProgram({ ...base, kind: 'fullbody' }).days[1]
    expect(b.items.at(-1)?.exerciseId).toBe('builtin-crunch')
  })

  it('«другой вариант» меняет вспомогательные, базовые остаются', () => {
    const input = { ...base, level: 'intermediate' as const, kind: 'ppl' as const }
    const a = buildProgram(input, 0)
    const b = buildProgram(input, 1)
    expect(ids(a)).not.toEqual(ids(b))
    expect(a.days.map((d) => d.items[0].exerciseId)).toEqual(
      b.days.map((d) => d.items[0].exerciseId),
    )
  })

  it('стартовые веса: от веса тела с поправками, штанга не легче грифа', () => {
    const p = buildProgram({ ...base, level: 'intermediate' })
    expect(item(p, 'bench-press')?.weightKg).toBe(52.5)
    const f = buildProgram({
      ...base,
      level: 'intermediate',
      sex: 'female',
      weightKg: 60,
      heightCm: 165,
    })
    expect(item(f, 'bench-press')?.weightKg).toBe(22.5)
    expect(item(f, 'squat')?.weightKg).toBe(35)
    // при большом ИМТ лишний вес учитывается на треть
    expect(strengthBase(80, 180)).toBe(80)
    expect(strengthBase(120, 180)).toBeCloseTo(81 + 39 / 3)
  })
})
