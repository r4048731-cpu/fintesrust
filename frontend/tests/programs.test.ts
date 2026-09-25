import { describe, expect, it } from 'vitest'
import {
  addDay,
  copyDay,
  formatPlan,
  formatRest,
  move,
  moveDay,
  newPlanItem,
  removeDay,
  updatePlanItem,
} from '../src/domain/programs'
import { plural } from '../src/domain/plural'
import type { Program } from '../src/domain/types'

const program = (): Program => ({
  id: 'p',
  name: 'Верх/Низ',
  days: [
    { id: 'a', name: 'Верх', items: [newPlanItem({ id: 'bench', type: 'weight' })] },
    { id: 'b', name: 'Низ', items: [] },
  ],
  updatedAt: 0,
  deletedAt: null,
})

describe('правка программы', () => {
  it('move не выходит за границы', () => {
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    expect(move([1, 2, 3], 2, 1)).toEqual([1, 2, 3])
  })

  it('дни добавляются с буквами, копия встаёт после оригинала с новыми id', () => {
    const p = addDay(program())
    expect(p.days.map((d) => d.name)).toEqual(['Верх', 'Низ', 'День C'])
    const c = copyDay(p, 'a')
    expect(c.days.map((d) => d.name)).toEqual(['Верх', 'Верх (копия)', 'Низ', 'День C'])
    expect(c.days[1].id).not.toBe('a')
    expect(c.days[1].items).toEqual(c.days[0].items)
    expect(c.days[1].items).not.toBe(c.days[0].items)
  })

  it('последний день удалить нельзя, дни переставляются', () => {
    const one = removeDay(program(), 'b')
    expect(one.days).toHaveLength(1)
    expect(removeDay(one, 'a').days).toHaveLength(1)
    expect(moveDay(program(), 'b', -1).days.map((d) => d.id)).toEqual(['b', 'a'])
  })

  it('updatePlanItem держит пределы и согласует «от» и «до»', () => {
    const item = newPlanItem({ id: 'bench', type: 'weight' })
    expect(updatePlanItem(item, { repsMin: 15 }, 'weight')).toMatchObject({
      repsMin: 15,
      repsMax: 15,
    })
    expect(updatePlanItem(item, { repsMax: 5 }, 'weight')).toMatchObject({ repsMin: 5, repsMax: 5 })
    expect(updatePlanItem(item, { sets: 0, weightKg: -5, restSec: 9999 }, 'weight')).toMatchObject({
      sets: 1,
      weightKg: 0,
      restSec: 600,
    })
    expect(updatePlanItem({ ...item, weightKg: 20 }, {}, 'time').weightKg).toBe(0)
  })
})

describe('подписи', () => {
  it('formatPlan по типам упражнений', () => {
    const item = { exerciseId: 'x', sets: 3, repsMin: 8, repsMax: 12, weightKg: 62.5, restSec: 90 }
    expect(formatPlan(item, 'weight')).toBe('3 × 8–12 · 62,5 кг · отдых 1:30')
    expect(formatPlan({ ...item, repsMin: 10, repsMax: 10, weightKg: 10 }, 'bodyweight')).toBe(
      '3 × 10 · +10 кг · отдых 1:30',
    )
    expect(formatPlan({ ...item, repsMin: 30, repsMax: 60, restSec: 45 }, 'time')).toBe(
      '3 × 30–60 с · отдых 45 с',
    )
    expect(formatPlan({ ...item, weightKg: 0, restSec: 0 }, 'weight')).toBe('3 × 8–12')
  })

  it('formatRest и plural', () => {
    expect(formatRest(120)).toBe('2:00')
    expect(formatRest(75)).toBe('1:15')
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => plural(n, 'день', 'дня', 'дней'))).toEqual([
      'день',
      'дня',
      'дней',
      'дней',
      'день',
      'дня',
      'дней',
    ])
  })
})
