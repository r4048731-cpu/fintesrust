// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { DAY, setup } from './helpers'

type Repos = Awaited<ReturnType<typeof setup>>

function renderAt(path: string, repos: Repos) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(
    <DataProvider repos={repos}>
      <RouterProvider router={router} />
    </DataProvider>,
  )
  return { router, view, user: userEvent.setup() }
}

/** Программа «Верх/Низ»: в «Верхе» жим 2×10 по 60 кг и подтягивания 1×8. */
async function withProgram() {
  const repos = await setup()
  const p = await repos.programs.create('Верх/Низ')
  p.days[0].name = 'Верх'
  p.days[0].items = [
    {
      exerciseId: 'builtin-bench-press',
      sets: 2,
      repsMin: 8,
      repsMax: 10,
      weightKg: 60,
      restSec: 90,
    },
    { exerciseId: 'builtin-pull-up', sets: 1, repsMin: 8, repsMax: 8, weightKg: 0, restSec: 60 },
  ]
  p.days.push({ id: crypto.randomUUID(), name: 'Низ', items: [] })
  await repos.programs.save(p)
  return { repos, program: p }
}

/** Кнопка упражнения в списке тренировки. */
const exerciseRow = (name: string) =>
  screen.findByRole('button', { name: new RegExp(`^${name} —`) })

/** Открыть шторку упражнения из списка тренировки. */
async function openExercise(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await exerciseRow(name))
  return screen.findByRole('dialog', { name })
}

const setRow = (exercise: string, n: number) =>
  within(
    within(screen.getByRole('dialog', { name: exercise })).getByRole('list', { name: 'Подходы' }),
  ).getAllByRole('listitem')[n - 1]

describe('тренировка', () => {
  it('полный цикл: старт дня, подходы, отдых, завершение, сводка и следующий день', async () => {
    const { repos, program } = await withProgram()
    const { user, router } = renderAt('/', repos)

    await user.click(await screen.findByRole('button', { name: /^Начать:/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    // список упражнений, подходы — в шторке
    expect(await exerciseRow('Жим штанги лёжа')).toHaveTextContent('0 из 2 подходов · 60 кг')
    expect(await exerciseRow('Подтягивания')).toHaveTextContent('0 из 1 подходов')
    const bench = await openExercise(user, 'Жим штанги лёжа')
    expect(within(bench).getByText(/План: 2 × 8–10/)).toBeInTheDocument()
    expect(within(bench).getByText(/Первый раз/)).toBeInTheDocument()
    expect(within(setRow('Жим штанги лёжа', 1)).getByRole('textbox', { name: /вес/ })).toHaveValue(
      '60',
    )

    // вес первого подхода +2,5 — второй подтягивается
    await user.click(
      within(setRow('Жим штанги лёжа', 1)).getByRole('button', { name: /вес, кг: увеличить/ }),
    )
    expect(within(setRow('Жим штанги лёжа', 2)).getByRole('textbox', { name: /вес/ })).toHaveValue(
      '62,5',
    )

    await user.click(
      within(setRow('Жим штанги лёжа', 1)).getByRole('button', { name: 'Подход 1 выполнен' }),
    )
    expect(
      within(setRow('Жим штанги лёжа', 1)).getByRole('button', { name: 'Подход 1 выполнен' }),
    ).toHaveAttribute('aria-pressed', 'true')
    // отдых виден прямо в шторке
    const rest = within(bench).getByRole('timer', { name: 'Отдых' })
    // около полутора минут: часы экрана обновляются четыре раза в секунду
    expect(rest).toHaveTextContent(/1:[23]\d/)
    await user.click(within(rest).getByRole('button', { name: 'Готов' }))
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()

    // «Далее» листает к следующему упражнению, не закрывая шторку
    await user.click(within(bench).getByRole('button', { name: 'Далее: Подтягивания' }))
    await user.click(
      within(setRow('Подтягивания', 1)).getByRole('button', { name: 'Подход 1 выполнен' }),
    )
    expect(screen.getByText('2 из 3 подходов')).toBeInTheDocument()
    // последнее упражнение: шторка закрывается к списку, где оно отмечено сделанным
    await user.click(screen.getByRole('button', { name: 'К списку упражнений' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await exerciseRow('Подтягивания')).toHaveTextContent('1 из 1 подходов')
    expect(screen.getByRole('timer', { name: 'Отдых' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Завершить' }))
    const sheet = screen.getByRole('dialog', { name: 'Завершить тренировку?' })
    expect(within(sheet).getByText('Неотмеченные подходы не сохранятся.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Завершить' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Готово!' })).toBeInTheDocument()
    expect(screen.getByText('62,5 × 10')).toBeInTheDocument()
    expect(screen.getByText(/625/)).toBeInTheDocument() // тоннаж 62,5 × 10
    expect(screen.getByText(/Рекордов в этот раз нет/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Готово' }))
    expect(await screen.findByRole('heading', { name: 'Низ' })).toBeInTheDocument()
    const done = await repos.workouts.listDone()
    expect(done).toHaveLength(1)
    expect(done[0].entries.map((e) => e.sets.length)).toEqual([1, 1])
    expect((await repos.programs.nextDay(program.id))?.day.name).toBe('Низ')
  })

  it('незавершённая тренировка переживает перезапуск и видна на «Сегодня»', async () => {
    const { repos } = await withProgram()
    const first = renderAt('/', repos)
    await first.user.click(await screen.findByRole('button', { name: /^Начать:/ }))
    await openExercise(first.user, 'Жим штанги лёжа')
    await first.user.click(
      within(setRow('Жим штанги лёжа', 1)).getByRole('button', { name: 'Подход 1 выполнен' }),
    )
    await first.user.click(screen.getByRole('button', { name: 'Свернуть тренировку' }))
    first.view.unmount()

    const second = renderAt('/', repos)
    const banner = await screen.findByRole('button', { name: /Тренировка идёт/ })
    expect(banner).toHaveTextContent('1 из 3 подходов')
    expect(screen.queryByRole('button', { name: /^Начать:/ })).not.toBeInTheDocument()
    await second.user.click(banner)
    await openExercise(second.user, 'Жим штанги лёжа')
    expect(
      within(setRow('Жим штанги лёжа', 1)).getByRole('button', { name: 'Подход 1 выполнен' }),
    ).toHaveAttribute('aria-pressed', 'true')
    // отдых продолжает идти после перезапуска
    expect(screen.getByRole('timer', { name: 'Отдых' })).toBeInTheDocument()
  })

  it('без отмеченных подходов завершить нельзя, можно отменить', async () => {
    const { repos } = await withProgram()
    const { user, router } = renderAt('/', repos)
    await user.click(await screen.findByRole('button', { name: /^Начать:/ }))
    await exerciseRow('Жим штанги лёжа')
    await user.click(screen.getByRole('button', { name: 'Завершить' }))
    const sheet = screen.getByRole('dialog', { name: 'Завершить тренировку?' })
    expect(within(sheet).getByText(/Ни один подход не отмечен/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Отменить тренировку' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Подтверждение отмены' })
    await user.click(within(confirm).getByRole('button', { name: 'Отменить тренировку' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await repos.workouts.getActive()).toBeNull()
    expect(await repos.workouts.listDone()).toEqual([])
  })

  it('свободная тренировка: упражнение из справочника, прошлый результат подставляется', async () => {
    const repos = await setup()
    // прошлая тренировка с приседом 100 × 5
    const past = await repos.workouts.start(null)
    past.entries.push(await repos.workouts.buildEntry('builtin-squat', null))
    past.entries[0].sets = [{ weightKg: 100, reps: 5, done: true }]
    await repos.workouts.save(past)
    await repos.workouts.finish(past.id)

    const { user } = renderAt('/', repos)
    await user.click(await screen.findByRole('button', { name: 'Свободная тренировка без плана' }))
    await user.click(await screen.findByRole('button', { name: 'Упражнение' }))
    const picker = screen.getByRole('dialog', { name: 'Добавить упражнение' })
    await user.type(within(picker).getByRole('searchbox'), 'присед')
    await user.click(within(picker).getByRole('button', { name: /Приседания со штангой/ }))

    const region = await openExercise(user, 'Приседания со штангой')
    // «прошлый раз» подгружается из базы чуть позже самой карточки
    await waitFor(() => expect(region).toHaveTextContent('Прошлый раз: 100 × 5'))
    expect(within(region).getByRole('textbox', { name: /вес/ })).toHaveValue('100')
    await waitFor(async () =>
      expect((await repos.workouts.getActive())?.exerciseIds).toEqual(['builtin-squat']),
    )
  })

  it('рекорд в сводке', async () => {
    const repos = await setup()
    const past = await repos.workouts.start(null)
    past.entries.push(await repos.workouts.buildEntry('builtin-bench-press', null))
    past.entries[0].sets = [{ weightKg: 60, reps: 10, done: true }]
    await repos.workouts.save(past)
    await repos.workouts.finish(past.id)

    repos.clock.advance(DAY)
    const now = await repos.workouts.start(null)
    now.entries.push(await repos.workouts.buildEntry('builtin-bench-press', null))
    now.entries[0].sets = [{ weightKg: 65, reps: 6, done: true }]
    await repos.workouts.save(now)
    await repos.workouts.finish(now.id)

    renderAt(`/workout/${now.id}/summary`, repos)
    expect(await screen.findByText('Новые рекорды')).toBeInTheDocument()
    expect(screen.getByText('Вес: было 60 кг')).toBeInTheDocument()
    expect(screen.getByText('65 кг')).toBeInTheDocument()
  })
})
