// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import type { WorkoutSet } from '../src/domain/types'
import { DAY, setup } from './helpers'

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

/** Завершённая тренировка с одним упражнением; часы сдвигаются на `daysLater` суток. */
async function logWorkout(
  r: Repos,
  name: string,
  exerciseId: string,
  sets: WorkoutSet[],
  daysLater = 0,
) {
  r.clock.advance(daysLater * DAY)
  const w = await r.workouts.start(null)
  w.name = name
  w.entries.push(await r.workouts.buildEntry(exerciseId, null))
  w.entries[0].sets = sets
  await r.workouts.save(w)
  r.clock.advance(45 * 60 * 1000)
  return (await r.workouts.finish(w.id)).workout
}

const done = (weightKg: number, reps: number): WorkoutSet => ({ weightKg, reps, done: true })

describe('история', () => {
  it('список по месяцам, новые сверху, с длительностью и тоннажем', async () => {
    const r = await setup()
    r.clock.set(new Date(2026, 7, 28, 18, 0))
    await logWorkout(r, 'Август', 'builtin-squat', [done(100, 5)])
    await logWorkout(r, 'Верх', 'builtin-bench-press', [done(60, 10), done(60, 8)], 5)
    await logWorkout(r, 'Низ', 'builtin-squat', [done(100, 5), done(100, 5)], 2)

    renderAt('/history', r)
    const sept = await screen.findByRole('region', { name: 'Сентябрь 2026' })
    const rows = within(sept).getAllByRole('button')
    expect(rows.map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^4птНиз45 мин · 2 подхода1\s000кг/),
      expect.stringMatching(/^2срВерх45 мин · 2 подхода1\s080кг/),
    ])
    expect(screen.getByRole('region', { name: 'Август 2026' })).toHaveTextContent('Август')
    expect(screen.getByText('3 тренировки')).toBeInTheDocument()
  })

  it('карточка тренировки показывает подходы и рекорды того дня', async () => {
    const r = await setup()
    await logWorkout(r, 'Верх', 'builtin-bench-press', [done(60, 10)])
    const second = await logWorkout(r, 'Верх', 'builtin-bench-press', [done(65, 5)], 3)

    const { user } = renderAt('/history', r)
    await user.click((await screen.findAllByRole('button', { name: /Верх/ }))[0])
    expect(await screen.findByRole('heading', { level: 1, name: 'Верх' })).toBeInTheDocument()
    expect(screen.getByText('65 × 5')).toBeInTheDocument()
    expect(screen.getByText('Вес: было 60 кг')).toBeInTheDocument()
    expect(second.id).toBeTruthy()
  })

  it('правка: вес, лишний подход, дата — сохраняются', async () => {
    const r = await setup()
    const w = await logWorkout(r, 'Верх', 'builtin-bench-press', [done(60, 10), done(60, 8)])

    const { user, router } = renderAt(`/history/${w.id}`, r)
    await user.click(await screen.findByRole('button', { name: 'Изменить' }))
    await screen.findByText('Правка тренировки')

    await user.click(screen.getByRole('button', { name: /^Жим штанги лёжа —/ }))
    const region = await screen.findByRole('dialog', { name: 'Жим штанги лёжа' })
    const rows = within(within(region).getByRole('list', { name: 'Подходы' })).getAllByRole(
      'listitem',
    )
    await user.click(within(rows[0]).getByRole('button', { name: /вес, кг: увеличить/ }))
    // снять отметку со второго подхода — при «Готово» он уйдёт
    await user.click(within(rows[1]).getByRole('button', { name: 'Подход 2 выполнен' }))
    // поле даты в jsdom не принимает ввод с клавиатуры — меняем значение напрямую, как это делает календарь
    await user.click(within(region).getByRole('button', { name: 'Закрыть' }))
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '2026-09-20' } })
    await user.click(screen.getByRole('button', { name: 'Готово' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(`/history/${w.id}`))
    const saved = await r.workouts.get(w.id)
    expect(saved?.date).toBe('2026-09-20')
    expect(saved?.entries[0].sets).toEqual([done(62.5, 10)])
    expect(saved!.finishedAt! - saved!.startedAt).toBe(45 * 60 * 1000)
    expect(await screen.findByText('62,5 × 10')).toBeInTheDocument()
  })

  it('если снять все отметки, «Готово» предлагает удалить тренировку', async () => {
    const r = await setup()
    const w = await logWorkout(r, 'Верх', 'builtin-bench-press', [done(60, 10)])
    const { user, router } = renderAt(`/history/${w.id}/edit`, r)
    await user.click(await screen.findByRole('button', { name: /^Жим штанги лёжа —/ }))
    await user.click(await screen.findByRole('button', { name: 'Подход 1 выполнен' }))
    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    await user.click(screen.getByRole('button', { name: 'Готово' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Нет подходов' })
    await user.click(within(confirm).getByRole('button', { name: 'Удалить тренировку' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/progress'))
    expect(await r.workouts.listDone()).toEqual([])
  })

  it('удаление из карточки с подтверждением', async () => {
    const r = await setup()
    const w = await logWorkout(r, 'Верх', 'builtin-bench-press', [done(60, 10)])
    const { user, router } = renderAt(`/history/${w.id}`, r)
    await user.click(await screen.findByRole('button', { name: 'Удалить тренировку' }))
    await user.click(screen.getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/progress'))
    expect(await screen.findByText('Тренировок пока нет')).toBeInTheDocument()
    expect((await r.workouts.get(w.id))?.deletedAt).not.toBeNull()
  })

  it('правка несуществующей или активной тренировки не открывается', async () => {
    const r = await setup()
    const active = await r.workouts.start(null)
    renderAt(`/history/${active.id}/edit`, r)
    expect(
      await screen.findByRole('heading', { name: 'Тренировка не найдена' }),
    ).toBeInTheDocument()
  })
})
