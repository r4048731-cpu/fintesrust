// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { createBackup, parseBackup, restoreBackup } from '../src/data/backup'
import { FitnessDB } from '../src/data/db'
import { createRepositories } from '../src/data'
import { FOODS, foodsFromMeals, searchFoods } from '../src/domain/foods'
import { COLLECTIONS, RECIPES, recipeGrams, recipeNutrients } from '../src/domain/recipes'
import { toISODate } from '../src/domain/metrics'
import {
  addDays,
  caloriesFromMacros,
  dailyTotals,
  estimatePlan,
  scaleNutrients,
  sumNutrients,
} from '../src/domain/nutrition'
import { setup } from './helpers'

const food = (name: string, calories: number, grams: number | null = null) => ({
  name,
  grams,
  calories,
  protein: 10,
  fat: 5,
  carbs: 20,
})

describe('питание: расчёты', () => {
  it('суммирует и округляет: ккал до целых, Б/Ж/У до десятых', () => {
    expect(
      sumNutrients([
        { calories: 100.4, protein: 1.04, fat: 0, carbs: 2.25 },
        { calories: 50.3, protein: 2.02, fat: 1, carbs: 0 },
      ]),
    ).toEqual({ calories: 151, protein: 3.1, fat: 1, carbs: 2.3 })
  })

  it('пересчитывает порцию по весу, без веса — оставляет как есть', () => {
    const n = { calories: 200, protein: 10, fat: 4, carbs: 30 }
    expect(scaleNutrients(n, 100, 250)).toEqual({ calories: 500, protein: 25, fat: 10, carbs: 75 })
    expect(scaleNutrients(n, null, 250)).toEqual(n)
  })

  it('калории по Б/Ж/У — 4, 9 и 4 ккал на грамм', () => {
    expect(caloriesFromMacros({ protein: 10, fat: 10, carbs: 10 })).toBe(170)
  })

  it('итоги по дням: пустые дни — нули, порядок от старых к новым', () => {
    const meal = (date: string, calories: number) => ({
      id: date + calories,
      date,
      name: 'x',
      grams: null,
      calories,
      protein: 0,
      fat: 0,
      carbs: 0,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
    })
    const days = dailyTotals(
      [meal('2026-10-12', 300), meal('2026-10-14', 100), meal('2026-10-14', 50)],
      '2026-10-14',
      3,
    )
    expect(days.map((d) => [d.date, d.total.calories])).toEqual([
      ['2026-10-12', 300],
      ['2026-10-13', 0],
      ['2026-10-14', 150],
    ])
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('расчёт нормы', () => {
  const man = {
    sex: 'male' as const,
    age: 30,
    heightCm: 180,
    activity: 'moderate' as const,
    goal: 'maintain' as const,
  }

  it('Миффлин — Сан Жеор с активностью; жиры 30 %, углеводы — остаток', () => {
    // 10·80 + 6,25·180 − 5·30 + 5 = 1780; ×1,55 = 2759
    expect(estimatePlan(man, 80)).toEqual({
      bmr: 1780,
      maintenance: 2759,
      calories: 2760,
      protein: 128,
      fat: 92,
      carbs: 355,
    })
  })

  it('цель сдвигает калории и белок; ниже безопасного минимума не опускается', () => {
    expect(estimatePlan({ ...man, goal: 'lose' }, 80)).toMatchObject({
      calories: 2210,
      protein: 144,
    })
    expect(estimatePlan({ ...man, goal: 'gain' }, 80).calories).toBe(3030)
    const tiny = {
      ...man,
      sex: 'female' as const,
      age: 70,
      heightCm: 150,
      activity: 'none' as const,
    }
    expect(estimatePlan({ ...tiny, goal: 'lose' }, 40).calories).toBe(1200)
  })
})

describe('справочник продуктов', () => {
  it('у каждого продукта калории сходятся с Б/Ж/У, названия не повторяются', () => {
    const names = new Set(FOODS.map((f) => f.name.toLowerCase()))
    expect(names.size).toBe(FOODS.length)
    for (const f of FOODS.filter((x) => !/кола|сок|сахар|мёд/i.test(x.name))) {
      const byMacros = caloriesFromMacros(f.per100)
      // справочные калории считают по уточнённым коэффициентам — допускаем 15 %
      expect(Math.abs(byMacros - f.per100.calories), f.name).toBeLessThanOrEqual(
        Math.max(15, f.per100.calories * 0.15),
      )
    }
  })

  it('ищет по началам слов, без учёта регистра и «ё»', () => {
    expect(searchFoods('гре вар', []).map((f) => f.name)).toEqual(['Гречка варёная'])
    expect(searchFoods('свекла', []).map((f) => f.name)).toEqual(['Свёкла'])
    expect(searchFoods('грудка', []).map((f) => f.name)).toContain('Индейка, грудка (сырая)')
    // сначала то, что начинается с запроса
    expect(searchFoods('кур', [])[0].name).toBe('Куриная грудка (сырая)')
    expect(searchFoods('  ', [])).toEqual([])
  })

  it('свои продукты — на 100 г, сверху и вместо одноимённых из справочника', () => {
    const meal = (name: string, grams: number | null, calories: number) => ({
      id: name,
      date: '2026-10-14',
      name,
      grams,
      calories,
      protein: 20,
      fat: 0,
      carbs: 0,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
    })
    const own = foodsFromMeals([
      meal('Гречка варёная', 200, 240),
      meal('Гречка с курицей', null, 500),
    ])
    expect(own).toEqual([
      {
        name: 'Гречка варёная',
        per100: { calories: 120, protein: 10, fat: 0, carbs: 0 },
        own: true,
      },
    ])
    const found = searchFoods('греч', own)
    expect(found[0]).toMatchObject({ name: 'Гречка варёная', own: true })
    expect(found.filter((f) => f.name === 'Гречка варёная')).toHaveLength(1)
  })
})

describe('рецепты', () => {
  it('все ингредиенты есть в справочнике, КБЖУ считаются из них', () => {
    for (const r of RECIPES) {
      const n = recipeNutrients(r)
      expect(n.calories, r.title).toBeGreaterThan(100)
      expect(COLLECTIONS.some((c) => c.id === r.collection)).toBe(true)
    }
    const cream = RECIPES.find((r) => r.id === 'choco-cottage-cream')!
    // творог 200 г (242) + йогурт 100 г (59) + какао 10 г (28,9) + мёд 15 г (49,35)
    expect(recipeNutrients(cream).calories).toBe(379)
    expect(recipeGrams(cream)).toBe(325)
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length)
  })
})

describe('питание: хранение', () => {
  it('добавляет, правит, удаляет; удалённое не видно', async () => {
    const r = await setup()
    const a = await r.meals.add(food('  Гречка   с курицей ', 450.6, 300), '2026-10-14')
    expect(a).toMatchObject({ name: 'Гречка с курицей', calories: 451, grams: 300 })
    r.clock.advance(1000)
    const b = await r.meals.add(food('Кефир', 120), '2026-10-14')
    await r.meals.update(b.id, food('Кефир', 130, 250))
    expect((await r.meals.listDay('2026-10-14')).map((m) => [m.name, m.calories])).toEqual([
      ['Гречка с курицей', 451],
      ['Кефир', 130],
    ])
    await r.meals.remove(a.id)
    expect((await r.meals.listDay('2026-10-14')).map((m) => m.name)).toEqual(['Кефир'])
    expect(await r.meals.listRange('2026-10-01', '2026-10-31')).toHaveLength(1)
  })

  it('не принимает пустое название и неверные числа', async () => {
    const r = await setup()
    await expect(r.meals.add(food('  ', 100), '2026-10-14')).rejects.toThrow('Введите название')
    await expect(r.meals.add(food('Суп', -1), '2026-10-14')).rejects.toThrow('Калории')
    await expect(r.meals.add(food('Суп', 100, 0), '2026-10-14')).rejects.toThrow('Вес порции')
  })

  it('недавние — без повторов по названию, последний вариант, новые сверху', async () => {
    const r = await setup()
    await r.meals.add(food('Овсянка', 300), '2026-10-12')
    await r.meals.add(food('Яйца', 150), '2026-10-13')
    r.clock.advance(1000)
    await r.meals.add(food('овсянка', 350), '2026-10-14')
    const recent = await r.meals.recent()
    expect(recent.map((m) => [m.name, m.calories])).toEqual([
      ['овсянка', 350],
      ['Яйца', 150],
    ])
  })

  it('попадает в резервную копию и восстанавливается; старые копии без питания читаются', async () => {
    const r = await setup()
    await r.meals.add(food('Рис', 200), '2026-10-14')
    await r.meta.set('nutritionPlan', { calories: 2200, protein: 150, fat: 70, carbs: 230 })
    const backup = parseBackup(JSON.stringify(await createBackup(r.db, r.clock())))
    expect(backup.meals).toHaveLength(1)

    const db = new FitnessDB(`test-${crypto.randomUUID()}`)
    const target = createRepositories(db, r.clock)
    await target.init()
    await restoreBackup(db, backup)
    expect((await target.meals.listDay('2026-10-14')).map((m) => m.name)).toEqual(['Рис'])
    expect(await target.meta.get('nutritionPlan')).toMatchObject({ calories: 2200 })

    const { meals: _, ...old } = backup
    expect(parseBackup(JSON.stringify(old)).meals).toEqual([])
  })
})

describe('вкладка «Питание»', () => {
  async function openFood() {
    const r = await setup()
    r.clock.set(new Date())
    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(
      <DataProvider repos={r}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: 'Питание' }))
    return { r, user, router }
  }

  it('добавляет еду, пересчитывает порцию по весу и считает итог против плана', async () => {
    const { r, user, router } = await openFood()
    expect(router.state.location.pathname).toBe('/food')

    await user.click(await screen.findByRole('button', { name: 'Задать план' }))
    await user.type(screen.getByRole('textbox', { name: 'Ккал' }), '2000')
    await user.type(screen.getByRole('textbox', { name: 'Белки, г' }), '150')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () =>
      expect(await r.meta.get('nutritionPlan')).toMatchObject({ calories: 2000, protein: 150 }),
    )

    await user.click(screen.getByRole('button', { name: 'Добавить еду' }))
    await user.type(screen.getByRole('textbox', { name: 'Название' }), 'Творог')
    await user.type(screen.getByRole('textbox', { name: 'Вес, г' }), '100')
    await user.type(screen.getByRole('textbox', { name: 'Ккал' }), '120')
    await user.type(screen.getByRole('textbox', { name: 'Белки, г' }), '18')
    // вес порции меняется — значения пересчитываются от введённых
    const grams = screen.getByRole('textbox', { name: 'Вес, г' })
    await user.clear(grams)
    await user.type(grams, '200')
    expect(screen.getByRole('textbox', { name: 'Ккал' })).toHaveValue('240')
    expect(screen.getByRole('textbox', { name: 'Белки, г' })).toHaveValue('36')
    await user.click(screen.getByRole('button', { name: 'Добавить' }))

    const list = await screen.findByRole('list', { name: 'Приёмы пищи' })
    expect(within(list).getByText('Творог')).toBeInTheDocument()
    expect(within(list).getByText('240 ккал')).toBeInTheDocument()
    expect(screen.getByText(/Осталось 1\s760 ккал/)).toBeInTheDocument()
    const [meal] = await r.meals.listDay(toISODate(new Date()))
    expect(meal).toMatchObject({ name: 'Творог', grams: 200, calories: 240, protein: 36 })

    await user.click(within(list).getByRole('button', { name: 'Удалить «Творог»' }))
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Приёмы пищи' })).not.toBeInTheDocument(),
    )
  })

  it('«Расчёт КБЖУ»: последний вес подставлен, 5 уровней активности, «Сделать планом»', async () => {
    const { r, user, router } = await openFood()
    await r.bodyWeights.record(80)
    // из шторки плана — переход в расчёт
    await user.click(await screen.findByRole('button', { name: 'Задать план' }))
    await user.click(screen.getByRole('button', { name: /Рассчитать по весу/ }))
    expect(router.state.location.search).toBe('?tab=calc')

    expect(await screen.findByRole('textbox', { name: 'Вес, кг' })).toHaveValue('80')
    const scale = screen.getByRole('radiogroup', { name: 'Уровень активности' })
    expect(within(scale).getAllByRole('radio')).toHaveLength(5)
    expect(within(scale).getByRole('radio', { checked: true })).toHaveAccessibleName(
      /3: 3–4 тренировки/,
    )
    await user.click(within(scale).getByRole('radio', { name: /^5:/ }))
    expect(screen.getByRole('heading', { name: 'Тяжёлая работа и спорт' })).toBeInTheDocument()
    await user.click(within(scale).getByRole('radio', { name: /^3:/ }))

    await user.click(screen.getByRole('button', { name: 'Рассчитать' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Рост')
    await user.type(screen.getByRole('textbox', { name: 'Рост, см' }), '180')
    await user.type(screen.getByRole('textbox', { name: 'Возраст' }), '30')
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }))
    const result = screen.getByRole('region', { name: 'Ваша норма' })
    expect(result).toHaveTextContent(/2\s760/)
    expect(result).toHaveTextContent('128')
    expect(within(result).getByRole('status')).toHaveTextContent(/Обмен в покое ≈ 1\s780/)

    await user.click(within(result).getByRole('button', { name: 'Сделать планом' }))
    await waitFor(async () =>
      expect(await r.meta.get('nutritionPlan')).toEqual({
        calories: 2760,
        protein: 128,
        fat: 92,
        carbs: 355,
      }),
    )
    expect(router.state.location.search).toBe('')
    expect(await r.meta.get('bodyProfile')).toMatchObject({ age: 30, heightCm: 180, sex: 'male' })
    expect(await screen.findByText(/Осталось 2\s760 ккал/)).toBeInTheDocument()
  })

  it('рецепт открывается с составом и добавляется в дневник', async () => {
    const { r, user, router } = await openFood()
    await user.click(await screen.findByRole('button', { name: 'Рецепты' }))
    expect(router.state.location.search).toBe('?tab=recipes')
    const breakfast = await screen.findByRole('region', { name: 'Белковый завтрак' })
    await user.click(
      within(breakfast).getByRole('button', { name: /ккал ?Шоколадный творожный крем/ }),
    )
    const ingredients = await screen.findByRole('list', { name: 'Ингредиенты' })
    expect(within(ingredients).getByText('Творог 5%')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Добавить в дневник' }))
    await waitFor(async () =>
      expect((await r.meals.listDay(toISODate(new Date())))[0]).toMatchObject({
        name: 'Шоколадный творожный крем',
        grams: 325,
      }),
    )
    expect(router.state.location.search).toBe('')
  })

  it('листает дни: вперёд дальше сегодня нельзя, еда добавляется в выбранный день', async () => {
    const { r, user } = await openFood()
    expect(await screen.findByRole('heading', { name: 'Сегодня' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Следующий день' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Предыдущий день' }))
    expect(screen.getByRole('heading', { name: 'Вчера' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Добавить еду' }))
    await user.type(screen.getByRole('textbox', { name: 'Название' }), 'Суп')
    await user.type(screen.getByRole('textbox', { name: 'Ккал' }), '200')
    await user.click(screen.getByRole('button', { name: 'Добавить' }))
    const yesterday = addDays(toISODate(new Date()), -1)
    await waitFor(async () =>
      expect((await r.meals.listDay(yesterday)).map((m) => m.name)).toEqual(['Суп']),
    )
  })

  it('продукт из справочника заполняет КБЖУ по введённым граммам', async () => {
    const { r, user } = await openFood()
    await user.click(await screen.findByRole('button', { name: 'Добавить еду' }))
    await user.type(screen.getByRole('textbox', { name: 'Вес, г' }), '200')
    await user.type(screen.getByRole('textbox', { name: 'Название' }), 'гречка вар')
    const list = screen.getByRole('list', { name: 'Подходящие продукты' })
    await user.click(within(list).getByRole('button', { name: /Гречка варёная/ }))
    expect(screen.queryByRole('list', { name: 'Подходящие продукты' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Название' })).toHaveValue('Гречка варёная')
    expect(screen.getByRole('textbox', { name: 'Ккал' })).toHaveValue('184')
    expect(screen.getByRole('textbox', { name: 'Белки, г' })).toHaveValue('6,8')

    // без веса — на 100 г, дальше пересчёт по граммам
    const grams = screen.getByRole('textbox', { name: 'Вес, г' })
    await user.clear(grams)
    await user.type(grams, '150')
    expect(screen.getByRole('textbox', { name: 'Ккал' })).toHaveValue('138')
    await user.click(screen.getByRole('button', { name: 'Добавить' }))
    await waitFor(async () =>
      expect((await r.meals.listDay(toISODate(new Date())))[0]).toMatchObject({
        name: 'Гречка варёная',
        grams: 150,
        calories: 138,
      }),
    )
  })

  it('недавнее блюдо подставляется одним нажатием', async () => {
    const { r, user } = await openFood()
    await r.meals.add(food('Омлет', 250, 150), addDays(toISODate(new Date()), -1))
    await user.click(await screen.findByRole('button', { name: 'Добавить еду' }))
    const recent = await screen.findByRole('group', { name: 'Недавние блюда' })
    await user.click(within(recent).getByRole('button', { name: /Омлет/ }))
    expect(screen.getByRole('textbox', { name: 'Название' })).toHaveValue('Омлет')
    expect(screen.getByRole('textbox', { name: 'Ккал' })).toHaveValue('250')
  })
})
