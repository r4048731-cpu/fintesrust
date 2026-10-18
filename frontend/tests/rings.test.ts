import { describe, expect, it } from 'vitest'
import { caloriesRing, stepsRing, trainingRing } from '../src/domain/rings'

describe('кольца дня', () => {
  it('тренировка: идёт, была, не было', () => {
    expect(trainingRing({ done: 5, total: 20 }, 0)).toMatchObject({
      share: 0.25,
      value: '5 из 20 подходов',
    })
    expect(trainingRing(null, 1)).toMatchObject({ share: 1, done: true, value: 'Выполнена' })
    expect(trainingRing(null, 2).value).toBe('2 тренировки')
    expect(trainingRing(null, 0)).toMatchObject({ share: 0, done: false })
    expect(trainingRing({ done: 0, total: 0 }, 0).share).toBe(0)
  })

  it('калории: доля от плана, перебор, без плана', () => {
    const r = caloriesRing(1100, 2200)
    expect(r.share).toBe(0.5)
    expect(r.value).toMatch(/^1\s100 \/ 2\s200 ккал$/)
    expect(caloriesRing(2450, 2200)).toMatchObject({ share: 1, done: true })
    expect(caloriesRing(2450, 2200).value).toMatch(/^\+250 сверх плана$/)
    expect(caloriesRing(0, null)).toMatchObject({ share: 0, value: 'План не задан' })
  })

  it('шаги', () => {
    expect(stepsRing(4000, 8000)).toMatchObject({ share: 0.5, done: false })
    expect(stepsRing(9000, 8000)).toMatchObject({ share: 1, done: true })
  })
})
