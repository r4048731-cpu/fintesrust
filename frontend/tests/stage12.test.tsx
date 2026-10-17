// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
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

describe('карточка упражнения', () => {
  it('из справочника: рекорды в «Истории» и «В программу»', async () => {
    const r = await setup()
    const past = await r.workouts.start(null)
    past.entries.push(await r.workouts.buildEntry('builtin-bench-press', null))
    past.entries[0].sets = [
      { weightKg: 60, reps: 10, done: true },
      { weightKg: 70, reps: 5, done: true },
    ]
    await r.workouts.save(past)
    await r.workouts.finish(past.id)
    const p = await r.programs.create('Верх/Низ')
    p.days[0].name = 'Верх'
    await r.programs.save(p)

    const { user } = renderAt('/programs/exercises', r)
    await user.type(await screen.findByRole('searchbox'), 'жим штанги лёжа')
    await user.click(screen.getByRole('button', { name: /^Жим штанги лёжа/ }))
    const card = screen.getByRole('dialog', { name: 'Жим штанги лёжа' })
    expect(card).toHaveTextContent('Грудь · Вес × повторения')

    await user.click(within(card).getByRole('button', { name: 'История' }))
    const records = await within(card).findByRole('group', { name: 'Рекорды' })
    expect(records).toHaveTextContent('Макс. вес70 кг')
    // расчётный 1ПМ — лучший из подходов, округлён до килограмма
    expect(records).toHaveTextContent(/Расч\. 1ПМ8\d кг/)
    expect(records).toHaveTextContent('Тренировок1')

    await user.click(within(card).getByRole('button', { name: 'В программу' }))
    const picker = screen.getByRole('dialog', { name: 'В какой день добавить' })
    await user.click(await within(picker).findByRole('button', { name: /Верх/ }))
    expect(await within(card).findByRole('status')).toHaveTextContent('Добавлено: Верх/Низ → Верх')
    await waitFor(async () =>
      expect((await r.programs.get(p.id))?.days[0].items.map((i) => i.exerciseId)).toEqual([
        'builtin-bench-press',
      ]),
    )
  })

  it('из дня программы: та же карточка, без «В программу»', async () => {
    const r = await setup()
    const p = await r.programs.create('П')
    p.days[0].items = [
      { exerciseId: 'builtin-squat', sets: 3, repsMin: 5, repsMax: 5, weightKg: 100, restSec: 120 },
    ]
    await r.programs.save(p)
    const { user } = renderAt(`/programs/${p.id}`, r)
    await user.click(
      await screen.findByRole('button', { name: 'Об упражнении «Приседания со штангой»' }),
    )
    const card = screen.getByRole('dialog', { name: 'Приседания со штангой' })
    expect(within(card).getByRole('button', { name: 'Изменить' })).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'В программу' })).not.toBeInTheDocument()
  })
})
