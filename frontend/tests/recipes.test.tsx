// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { createBackup, parseBackup, restoreBackup, wipeAll } from '../src/data/backup'
import { toISODate } from '../src/domain/metrics'
import { customView } from '../src/domain/recipes'
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

const egg = { calories: 157, protein: 12.7, fat: 11.5, carbs: 0.7 }

describe('рецепты: любимые и свои', () => {
  it('репозиторий: КБЖУ своего блюда по ингредиентам, проверка ввода, удаление из любимых', async () => {
    const r = await setup()
    await expect(
      r.recipes.add({ title: 'Омлет', minutes: 10, ingredients: [], steps: [] }),
    ).rejects.toThrow(/хотя бы один ингредиент/)
    const omelet = await r.recipes.add({
      title: ' Омлет ',
      minutes: 10,
      ingredients: [{ name: 'Яйцо куриное', grams: 110, per100: egg }],
      steps: ['Взбить', ' ', 'Жарить'],
    })
    expect(omelet).toMatchObject({ title: 'Омлет', steps: ['Взбить', 'Жарить'] })
    const v = customView(omelet)
    expect(v.grams).toBe(110)
    expect(Math.round(v.nutrients.calories)).toBe(173)

    expect(await r.recipes.toggleFavorite(omelet.id)).toBe(true)
    expect(await r.recipes.toggleFavorite('choco-cottage-cream')).toBe(true)
    expect(await r.recipes.favorites()).toEqual([omelet.id, 'choco-cottage-cream'])
    await r.recipes.remove(omelet.id)
    expect(await r.recipes.list()).toEqual([])
    expect(await r.recipes.favorites()).toEqual(['choco-cottage-cream'])
  })

  it('«В любимые» в карточке: рецепт на вкладке «Любимые блюда» и уходит оттуда', async () => {
    const { user } = renderAt('/food?tab=recipes', await setup())
    const breakfast = await screen.findByRole('region', { name: 'Белковый завтрак' })
    await user.click(
      within(breakfast).getByRole('button', { name: /ккал ?Шоколадный творожный крем/ }),
    )
    const sheet = screen.getByRole('dialog', { name: 'Шоколадный творожный крем' })
    await user.click(within(sheet).getByRole('button', { name: 'В любимые' }))
    expect(await within(sheet).findByRole('button', { name: 'В любимых' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(sheet).getByRole('button', { name: 'Закрыть' }))
    await user.click(screen.getByRole('tab', { name: /^Любимые блюда/ }))
    const favs = await screen.findByRole('list', { name: 'Любимые блюда' })
    expect(
      within(favs).getByRole('button', { name: /ккал ?Шоколадный творожный крем/ }),
    ).toBeInTheDocument()

    // убрать можно и сердечком на карточке
    await user.click(
      within(favs).getByRole('button', { name: '«Шоколадный творожный крем» в любимые' }),
    )
    expect(await screen.findByText('Любимых блюд пока нет')).toBeInTheDocument()
  })

  it('сердечко прямо на карточке, не открывая рецепт', async () => {
    const r = await setup()
    const { user } = renderAt('/food?tab=recipes', r)
    const breakfast = await screen.findByRole('region', { name: 'Белковый завтрак' })
    const heart = within(breakfast).getByRole('button', {
      name: '«Шоколадный творожный крем» в любимые',
    })
    expect(heart).toHaveAttribute('aria-pressed', 'false')
    await user.click(heart)
    await waitFor(async () => expect(await r.recipes.favorites()).toEqual(['choco-cottage-cream']))
    expect(heart).toHaveAttribute('aria-pressed', 'true')
    // карточка при этом не открылась
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^Любимые блюда/ }))
    expect(await screen.findByRole('list', { name: 'Любимые блюда' })).toHaveTextContent(
      'Шоколадный творожный крем',
    )
  })

  it('своё блюдо: добавить из справочника, в дневник, изменить, удалить', async () => {
    const r = await setup()
    const { user } = renderAt('/food?tab=recipes', r)
    // три вкладки: «Всё меню» по умолчанию
    expect(await screen.findByRole('tab', { name: /^Всё меню/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await user.click(screen.getByRole('tab', { name: /^Мои блюда/ }))
    expect(screen.getByText('Своих блюд пока нет')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Добавить своё блюдо' }))
    const form = screen.getByRole('dialog', { name: 'Своё блюдо' })
    await user.type(within(form).getByLabelText('Название'), 'Гречка с яйцом')

    // продукт только из подсказок — так известно его КБЖУ
    await user.type(within(form).getByLabelText('Продукт'), 'гречка вар')
    await user.click(within(form).getByRole('button', { name: /Гречка варёная/ }))
    const grams = within(form).getByLabelText('Вес, г')
    await user.clear(grams)
    await user.type(grams, '200')
    await user.click(within(form).getByRole('button', { name: 'Добавить ингредиент' }))
    await user.type(within(form).getByLabelText('Продукт'), 'яйцо кур')
    await user.click(within(form).getByRole('button', { name: /Яйцо куриное/ }))
    await user.clear(within(form).getByLabelText('Вес, г'))
    await user.type(within(form).getByLabelText('Вес, г'), '55')
    await user.click(within(form).getByRole('button', { name: 'Добавить ингредиент' }))
    // гречка 92 × 2 + яйцо 157 × 0,55 ≈ 270
    expect(within(form).getByRole('status', { name: 'Итого на порцию' })).toHaveTextContent(
      /Порция: 2(69|70|71) ккал/,
    )
    await user.click(within(form).getByRole('button', { name: 'Добавить блюдо' }))

    // после сохранения открывается карточка нового блюда
    const card = await screen.findByRole('dialog', { name: 'Гречка с яйцом' })
    expect(within(card).getByText('Порция 255 г · 15 мин')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Мои блюда' })).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Изменить' }))
    const edit = screen.getByRole('dialog', { name: 'Изменить блюдо' })
    await user.click(within(edit).getByRole('button', { name: 'Убрать «Яйцо куриное»' }))
    await user.click(within(edit).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () =>
      expect((await r.recipes.list())[0].ingredients.map((i) => i.name)).toEqual([
        'Гречка варёная',
      ]),
    )

    await user.click(within(card).getByRole('button', { name: 'Добавить в дневник' }))
    await waitFor(async () =>
      expect((await r.meals.listDay(toISODate(new Date())))[0]).toMatchObject({
        name: 'Гречка с яйцом',
        grams: 200,
        calories: 184,
      }),
    )

    await user.click(await screen.findByRole('button', { name: 'Рецепты' }))
    await user.click(await screen.findByRole('tab', { name: /^Мои блюда/ }))
    const mine = await screen.findByRole('list', { name: 'Мои блюда' })
    await user.click(within(mine).getByRole('button', { name: /ккал ?Гречка с яйцом/ }))
    const again = screen.getByRole('dialog', { name: 'Гречка с яйцом' })
    await user.click(within(again).getByRole('button', { name: 'Удалить' }))
    await user.click(
      within(within(again).getByRole('alertdialog')).getByRole('button', { name: 'Удалить' }),
    )
    await waitFor(async () => expect(await r.recipes.list()).toEqual([]))
  })

  it('счётчики на вкладках и поиск по названию и ингредиентам', async () => {
    const r = await setup()
    await r.recipes.add({
      title: 'Омлет',
      minutes: 5,
      ingredients: [{ name: 'Яйцо куриное', grams: 110, per100: egg }],
      steps: [],
    })
    await r.recipes.toggleFavorite('choco-cottage-cream')
    const { user } = renderAt('/food?tab=recipes', r)
    expect(await screen.findByRole('tab', { name: /^Мои блюда/ })).toHaveTextContent('Мои блюда1')
    expect(screen.getByRole('tab', { name: /^Любимые блюда/ })).toHaveTextContent('Любимые блюда1')

    // во «Всём меню» поиск идёт и по своим блюдам, и по ингредиентам
    const search = screen.getByRole('searchbox', { name: 'Поиск рецептов' })
    await user.type(search, 'яйц')
    const found = screen.getByRole('list', { name: 'Найденные рецепты' })
    expect(within(found).getByRole('button', { name: /ккал ?Омлет ?5 мин/ })).toBeInTheDocument()
    expect(
      within(found).getByRole('button', { name: /ккал ?Протеиновые блины/ }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Белковый завтрак' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^Любимые блюда/ }))
    expect(screen.getByText('Ничего не нашлось.')).toBeInTheDocument()
    await user.clear(search)
    expect(screen.getByRole('list', { name: 'Любимые блюда' })).toHaveTextContent(
      'Шоколадный творожный крем',
    )
  })

  it('«+» на карточке пишет порцию в дневник, «Отменить» убирает', async () => {
    const r = await setup()
    const { user } = renderAt('/food?tab=recipes', r)
    const breakfast = await screen.findByRole('region', { name: 'Белковый завтрак' })
    await user.click(
      within(breakfast).getByRole('button', { name: '«Шоколадный творожный крем» в дневник' }),
    )
    const today = toISODate(new Date())
    await waitFor(async () =>
      expect((await r.meals.listDay(today))[0]).toMatchObject({
        name: 'Шоколадный творожный крем',
        grams: 325,
      }),
    )
    // рецепт не открылся, вкладка осталась прежней
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('«Шоколадный творожный крем» — в дневнике')
    await user.click(within(status).getByRole('button', { name: 'Отменить' }))
    await waitFor(async () => expect(await r.meals.listDay(today)).toEqual([]))
  })

  it('свои блюда и любимые переживают экспорт → импорт', async () => {
    const r = await setup()
    const own = await r.recipes.add({
      title: 'Омлет',
      minutes: 5,
      ingredients: [{ name: 'Яйцо куриное', grams: 110, per100: egg }],
      steps: [],
    })
    await r.recipes.toggleFavorite(own.id)
    const file = JSON.stringify(await createBackup(r.db, r.clock()))
    await wipeAll(r.db)
    await restoreBackup(r.db, parseBackup(file))
    expect(await r.recipes.list()).toEqual([own])
    expect(await r.recipes.favorites()).toEqual([own.id])
  })
})
