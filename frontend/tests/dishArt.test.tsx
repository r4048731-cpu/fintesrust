// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DishArt } from '../src/components/DishArt'
import { dishArt } from '../src/domain/dishArt'
import { BUILTIN_VIEWS } from '../src/domain/recipes'

const ing = (...list: [string, number][]) => list.map(([name, grams]) => ({ name, grams }))

describe('картинка блюда', () => {
  it('посуда по названию', () => {
    const vessel = (title: string) => dishArt(title, []).vessel
    expect(vessel('Куриный суп с лапшой')).toBe('soup')
    expect(vessel('Окрошка на кефире')).toBe('soup')
    expect(vessel('Банановый смузи')).toBe('glass')
    expect(vessel('Шоколадный кекс в кружке')).toBe('mug')
    expect(vessel('Сырники на сковороде')).toBe('stack')
    expect(vessel('Тост с авокадо')).toBe('toast')
    expect(vessel('Домашняя шаурма')).toBe('wrap')
    expect(vessel('Шакшука')).toBe('pan')
    expect(vessel('Курица с гречкой')).toBe('plate')
  })

  it('основа и продукты — по составу, от самого весомого, без масла и соусов', () => {
    const art = dishArt(
      'Курица терияки с рисом',
      ing(
        ['Куриное бедро без кожи', 150],
        ['Рис белый (сухой)', 70],
        ['Соевый соус', 20],
        ['Брокколи', 150],
        ['Масло оливковое', 5],
      ),
    )
    expect(art.base).toBe('rice')
    expect(art.toppings).toEqual(['chicken', 'broccoli'])
  })

  it('творог с какао — шоколадный крем; яйца в тесте блинов не видно', () => {
    expect(
      dishArt('Шоколадный творожный крем', ing(['Творог 5%', 200], ['Какао-порошок', 10])).base,
    ).toBe('chocoCream')
    const pancakes = dishArt('Банановые оладьи', ing(['Банан', 120], ['Яйцо куриное', 55]))
    expect(pancakes.toppings).toEqual(['banana'])
  })

  it('своё блюдо с незнакомыми продуктами — просто тарелка', () => {
    expect(dishArt('Бабушкин пирожок', ing(['Что-то своё', 100]))).toMatchObject({
      vessel: 'cake',
      toppings: [],
    })
    expect(dishArt('Ужин', ing(['Что-то своё', 100]))).toMatchObject({
      vessel: 'plate',
      base: null,
    })
  })

  it('у каждого встроенного рецепта есть картинка, и они не все одинаковые', () => {
    const keys = new Set<string>()
    for (const r of BUILTIN_VIEWS) {
      const { container } = render(<DishArt title={r.title} ingredients={r.ingredients} />)
      expect(container.querySelector('svg')?.childElementCount, r.title).toBeGreaterThan(2)
      const art = dishArt(r.title, r.ingredients)
      keys.add(`${art.vessel}|${art.base}|${art.toppings.join()}|${art.fill}`)
    }
    expect(keys.size).toBeGreaterThan(BUILTIN_VIEWS.length * 0.9)
  })
})
