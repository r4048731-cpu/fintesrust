// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { isBarcode, parseProduct } from '../src/data/openFoodFacts'
import { toISODate } from '../src/domain/metrics'
import { addDays, estimatePlan, proteinWeightKg } from '../src/domain/nutrition'
import { planAdvice, weightTrend } from '../src/domain/planAdvice'
import { mergeSteps, stepsDays } from '../src/domain/steps'
import type { BodyProfile } from '../src/domain/types'
import { setup } from './helpers'

type Repos = Awaited<ReturnType<typeof setup>>

function renderAt(path: string, repos: Repos) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <DataProvider repos={repos}>
      <RouterProvider router={router} />
    </DataProvider>,
  )
  return { router, user: userEvent.setup() }
}

const man: BodyProfile = { sex: 'male', age: 30, heightCm: 180, activity: 'moderate', goal: 'lose' }
const plan = { calories: 2210, protein: 144, fat: 74, carbs: 254 }
const today = '2026-10-28'
/** Записи веса: [дней назад, кг]. */
const weights = (rows: [number, number][]) =>
  rows.map(([ago, kg]) => ({ date: addDays(today, -ago), weightKg: kg }))

afterEach(() => vi.unstubAllGlobals())

describe('белок от целевого веса', () => {
  it('на сушке — от цели, если она ниже; без цели при ИМТ > 30 — от ИМТ 25', () => {
    expect(proteinWeightKg({ ...man, targetKg: 75 }, 95)).toBe(75)
    expect(proteinWeightKg({ ...man, targetKg: 100 }, 95)).toBe(95)
    // 180 см: ИМТ 30 — 97,2 кг; при 110 кг белок от 25 · 1,8² = 81 кг
    expect(proteinWeightKg(man, 110)).toBe(81)
    expect(proteinWeightKg(man, 80)).toBe(80)
    expect(estimatePlan({ ...man, targetKg: 75 }, 95)).toMatchObject({
      proteinKg: 75,
      protein: 135,
    })
  })
})

describe('поправка плана по весу', () => {
  it('темп веса — кг в неделю по прямой', () => {
    expect(
      weightTrend(
        weights([
          [14, 81],
          [7, 80.5],
          [0, 80],
        ]),
      ),
    ).toBeCloseTo(-0.5)
  })

  it('вес ушёл на 2 кг с расчёта — пересчитать под новый вес', () => {
    const a = planAdvice({
      plan,
      basis: { setAt: addDays(today, -40), weightKg: 80 },
      profile: man,
      weights: weights([[0, 77.8]]),
      today,
    })
    expect(a).toMatchObject({ kind: 'recalc', fromKg: 80, toKg: 77.8 })
    expect(a!.next.calories).toBe(estimatePlan(man, 77.8).calories)
  })

  it('на сушке вес стоит три недели — минус калории, белок тот же', () => {
    const stall = weights([
      [20, 80],
      [14, 80.1],
      [7, 79.9],
      [0, 80],
    ])
    const a = planAdvice({ plan, basis: null, profile: man, weights: stall, today })
    expect(a).toMatchObject({ kind: 'adjust', targetPerWeek: -0.5, days: 20 })
    // отставание 0,5 кг в неделю — 550 ккал, но за раз не больше 300
    expect(a!.next).toMatchObject({ calories: 1910, protein: 144 })
  })

  it('темп по плану, мало записей, отложено или план только что задан — молчим', () => {
    const onTrack = weights([
      [21, 81.5],
      [14, 81],
      [7, 80.5],
      [0, 80],
    ])
    expect(planAdvice({ plan, basis: null, profile: man, weights: onTrack, today })).toBeNull()
    const stall = weights([
      [20, 80],
      [14, 80],
      [7, 80],
      [0, 80],
    ])
    expect(
      planAdvice({ plan, basis: null, profile: man, weights: stall.slice(1), today }),
    ).toBeNull()
    expect(
      planAdvice({
        plan,
        basis: { snoozedUntil: addDays(today, 3) },
        profile: man,
        weights: stall,
        today,
      }),
    ).toBeNull()
    expect(
      planAdvice({
        plan,
        basis: { setAt: addDays(today, -5) },
        profile: man,
        weights: stall,
        today,
      }),
    ).toBeNull()
    expect(planAdvice({ plan, basis: null, profile: null, weights: stall, today })).toBeNull()
  })

  it('«Дневник»: совет пересчитать, «Пересчитать» меняет план и запоминает вес', async () => {
    const r = await setup()
    r.clock.set(new Date())
    await r.bodyWeights.record(77.5)
    await r.meta.set('bodyProfile', man)
    await r.meta.set('nutritionPlan', plan)
    await r.meta.set('planBasis', { setAt: '2026-01-01', weightKg: 80 })
    const { user } = renderAt('/food', r)
    const card = await screen.findByRole('region', { name: 'Совет по плану' })
    expect(card).toHaveTextContent('Вес изменился на −2,5 кг с расчёта плана')
    await user.click(within(card).getByRole('button', { name: 'Пересчитать' }))
    await waitFor(async () =>
      expect((await r.meta.get('nutritionPlan'))!.calories).toBe(estimatePlan(man, 77.5).calories),
    )
    expect(await r.meta.get('planBasis')).toEqual({ setAt: toISODate(new Date()), weightKg: 77.5 })
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Совет по плану' })).not.toBeInTheDocument(),
    )
  })
})

describe('шаги в базе приложения', () => {
  it('свежие шаги поверх сохранённых, нули не затирают', () => {
    const history = { '2026-09-01': 5000, '2026-10-27': 3000 }
    expect(
      mergeSteps(history, [
        { date: '2026-09-01', steps: 0 },
        { date: '2026-10-27', steps: 9000 },
      ]),
    ).toEqual({ '2026-09-01': 5000, '2026-10-27': 9000 })
    expect(mergeSteps(history, [{ date: '2026-10-27', steps: 3000 }])).toBeNull()
    expect(stepsDays(history, '2026-10-28', 2)).toEqual([
      { date: '2026-10-27', steps: 3000 },
      { date: '2026-10-28', steps: 0 },
    ])
  })

  it('график шагов строится из сохранённых — и в браузере', async () => {
    const r = await setup()
    const t = toISODate(new Date())
    await r.meta.set('stepsHistory', { [addDays(t, -1)]: 6000, [t]: 9000 })
    renderAt('/progress?view=charts', r)
    expect(await screen.findByRole('img', { name: /^Шаги по дням: 2 дней/ })).toBeInTheDocument()
  })
})

describe('штрихкод', () => {
  it('ответ Open Food Facts → КБЖУ на 100 г и порция', () => {
    expect(isBarcode('4607001771234')).toBe(true)
    expect(isBarcode('123')).toBe(false)
    const food = parseProduct('4607001771234', {
      product: {
        product_name_ru: 'Йогурт греческий',
        brands: 'Молочный, Другой',
        serving_quantity: '140',
        nutriments: {
          'energy-kcal_100g': 66,
          proteins_100g: 8,
          fat_100g: 2,
          carbohydrates_100g: 3.5,
        },
      },
    })
    expect(food).toEqual({
      code: '4607001771234',
      name: 'Йогурт греческий, Молочный',
      per100: { calories: 66, protein: 8, fat: 2, carbs: 3.5 },
      servingG: 140,
    })
    // только килоджоули — пересчёт в ккал
    expect(
      parseProduct('1', { product: { product_name: 'X', nutriments: { energy_100g: 418.4 } } })!
        .per100.calories,
    ).toBe(100)
    expect(parseProduct('1', { status: 0 })).toBeNull()
  })

  it('цифры штрихкода вручную: продукт подставляется и запоминается', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            product: {
              product_name: 'Творог 5 %',
              serving_quantity: 200,
              nutriments: {
                'energy-kcal_100g': 121,
                proteins_100g: 17,
                fat_100g: 5,
                carbohydrates_100g: 1.8,
              },
            },
          }),
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const r = await setup()
    r.clock.set(new Date())
    const { user } = renderAt('/food', r)
    await user.click(await screen.findByRole('button', { name: /^Завтрак: 0 ккал/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Завтрак: добавить' })
    await user.click(within(sheet).getByRole('button', { name: 'Сканировать штрихкод' }))
    expect(await within(sheet).findByText(/Камера недоступна/)).toBeInTheDocument()
    await user.type(
      within(sheet).getByRole('textbox', { name: 'Цифры штрихкода' }),
      '4601234567893',
    )
    await user.click(within(sheet).getByRole('button', { name: 'Найти' }))
    expect(await within(sheet).findByRole('textbox', { name: 'Название' })).toHaveValue(
      'Творог 5 %',
    )
    expect(within(sheet).getByRole('textbox', { name: 'Вес, г' })).toHaveValue('200')
    expect(within(sheet).getByRole('textbox', { name: 'Ккал' })).toHaveValue('242')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/product/4601234567893.json'))
    expect((await r.meta.get('barcodeFoods'))['4601234567893'].name).toBe('Творог 5 %')
  })
})
