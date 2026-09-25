import { describe, expect, it } from 'vitest'
import { formatDecimal, parseDecimal, stepValue } from '../src/domain/number'

describe('parseDecimal', () => {
  it('понимает запятую и точку', () => {
    expect(parseDecimal('62,5')).toBe(62.5)
    expect(parseDecimal(' 62.5 ')).toBe(62.5)
    expect(parseDecimal('60')).toBe(60)
    expect(parseDecimal('60,')).toBe(60)
  })

  it('пустое и мусор — null', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('6,2,5')).toBeNull()
  })
})

describe('formatDecimal', () => {
  it('пишет через запятую без лишних нулей', () => {
    expect(formatDecimal(62.5)).toBe('62,5')
    expect(formatDecimal(60)).toBe('60')
    expect(formatDecimal(1.25)).toBe('1,25')
    expect(formatDecimal(0.1 + 0.2)).toBe('0,3')
  })
})

describe('stepValue', () => {
  it('шагает без ошибок округления и не выходит за границы', () => {
    expect(stepValue(0.1, 1, 0.2)).toBe(0.3)
    expect(stepValue(60, 1, 2.5)).toBe(62.5)
    expect(stepValue(1, -1, 2.5)).toBe(0)
    expect(stepValue(9, 1, 2.5, 0, 10)).toBe(10)
  })
})
