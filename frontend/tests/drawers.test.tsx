// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { toISODate } from '../src/domain/metrics'
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

describe('шторки по нажатию', () => {
  it('день недели на «Сегодня» показывает тренировку и ведёт в историю', async () => {
    const r = await setup()
    r.clock.set(new Date())
    const w = await r.workouts.start(null)
    w.entries = [
      {
        exerciseId: 'builtin-bench-press',
        restSec: 90,
        plan: null,
        sets: [{ weightKg: 60, reps: 10, done: true }],
      },
    ]
    await r.workouts.save(w)
    await r.workouts.finish(w.id)
    const { user, router } = renderAt('/', r)

    const week = await screen.findByRole('region', { name: 'Эта неделя' })
    await user.click(within(week).getByRole('button', { name: /сегодня/ }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('1 подход · 600 кг')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /Свободная тренировка/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/history/${w.id}`))
  })

  it('пустой день — так и написано', async () => {
    const { user } = renderAt('/', await setup())
    const week = await screen.findByRole('region', { name: 'Эта неделя' })
    await user.click(within(week).getByRole('button', { name: /сегодня/ }))
    expect(await screen.findByText('Сегодня тренировки ещё не было.')).toBeInTheDocument()
  })

  it('запись веса: правка за её день и удаление', async () => {
    const r = await setup()
    const now = new Date()
    r.clock.set(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 8))
    const row = await r.bodyWeights.record(80)
    const { user } = renderAt('/weight', r)

    const list = await screen.findByRole('list', { name: 'Вес по дням' })
    await user.click(within(list).getByRole('button', { name: /80 кг — изменить/ }))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: /увеличить на 0,1/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () =>
      expect(await r.bodyWeights.list()).toEqual([
        expect.objectContaining({ id: row.id, date: row.date, weightKg: 80.1 }),
      ]),
    )

    await user.click(await within(list).findByRole('button', { name: /80,1 кг — изменить/ }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Удалить запись' }),
    )
    await waitFor(async () => expect(await r.bodyWeights.list()).toEqual([]))
  })

  it('калории дня: доли Б/Ж/У и самое калорийное', async () => {
    const r = await setup()
    const today = toISODate(new Date())
    await r.meals.add(
      { name: 'Гречка', grams: 200, calories: 220, protein: 8, fat: 2, carbs: 42 },
      today,
    )
    await r.meals.add(
      { name: 'Курица', grams: 150, calories: 250, protein: 45, fat: 8, carbs: 0 },
      today,
    )
    const { user } = renderAt('/food', r)

    await user.click(await screen.findByRole('button', { name: /470 ккал — откуда калории/ }))
    const sheet = await screen.findByRole('dialog')
    // энергия: Б 53×4=212, Ж 10×9=90, У 42×4=168 → 470
    const shares = within(sheet).getByRole('region', { name: 'Откуда калории' })
    expect(within(shares).getByText(/53 г · 212 ккал/)).toHaveTextContent('45%')
    const top = within(
      within(sheet).getByRole('region', { name: 'Самое калорийное' }),
    ).getAllByRole('listitem')
    expect(top[0]).toHaveTextContent('Курица')
    expect(top[0]).toHaveTextContent('53%')
  })
})
