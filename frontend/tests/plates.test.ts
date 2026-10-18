import { describe, expect, it } from 'vitest'
import { groupPlates, plateLoad } from '../src/domain/plates'

describe('plateLoad', () => {
  it('набирает вес точно, тяжёлые блины первыми', () => {
    expect(plateLoad(100, 20)).toEqual({ perSide: [25, 15], totalKg: 100, missingKg: 0 })
    expect(plateLoad(72.5, 20)).toEqual({ perSide: [25, 1.25], totalKg: 72.5, missingKg: 0 })
  })

  it('пустой гриф и вес легче грифа', () => {
    expect(plateLoad(20, 20)).toEqual({ perSide: [], totalKg: 20, missingKg: 0 })
    expect(plateLoad(15, 20)).toEqual({ perSide: [], totalKg: 20, missingKg: -5 })
  })

  it('если точно не набрать, говорит, сколько не хватает', () => {
    const r = plateLoad(61, 20)
    expect(r.perSide).toEqual([20])
    expect(r.totalKg).toBe(60)
    expect(r.missingKg).toBe(1)
  })

  it('без грифа и своим набором блинов', () => {
    expect(plateLoad(50, 0).perSide).toEqual([25])
    expect(plateLoad(40, 20, [5]).perSide).toEqual([5, 5])
  })
})

describe('groupPlates', () => {
  it('собирает одинаковые блины подряд', () => {
    expect(groupPlates([20, 20, 5, 2.5])).toEqual([
      { kg: 20, count: 2 },
      { kg: 5, count: 1 },
      { kg: 2.5, count: 1 },
    ])
  })
})
