// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { techniqueCues, techniqueImages, techniqueSearchUrl } from '../src/domain/technique'
import { lightenEntries, replaceEntry } from '../src/domain/workout'
import type { Workout } from '../src/domain/types'
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

/** «Верх»: жим 2×10 по 60 кг; «Низ»: присед 1×5 по 100 кг. */
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
  ]
  p.days.push({
    id: crypto.randomUUID(),
    name: 'Низ',
    items: [
      { exerciseId: 'builtin-squat', sets: 1, repsMin: 5, repsMax: 5, weightKg: 100, restSec: 120 },
    ],
  })
  await repos.programs.save(p)
  return repos
}

const set = (weightKg: number, reps = 10) => ({ weightKg, reps, done: false })

describe('лёгкий день и замена упражнения', () => {
  it('лёгкий день: −20 %, вниз до шага; без веса и на время — без изменений', () => {
    const entries = [
      { exerciseId: 'a', restSec: 90, plan: null, sets: [set(100), set(62.5), set(0)] },
    ]
    expect(lightenEntries(entries, 2.5)[0].sets.map((s) => s.weightKg)).toEqual([80, 50, 0])
    expect(lightenEntries(entries, 5)[0].sets.map((s) => s.weightKg)).toEqual([80, 50, 0])
  })

  it('замена: план и отдых прежние, подходы от нового упражнения, их число — как было', () => {
    const w = {
      entries: [
        {
          exerciseId: 'old',
          restSec: 120,
          plan: { sets: 3, repsMin: 8, repsMax: 10, weightKg: 60 },
          sets: [{ ...set(60), done: true }, set(60), set(60)],
        },
      ],
    } as Workout
    const next = replaceEntry(w, 0, {
      exerciseId: 'new',
      restSec: 60,
      plan: null,
      sets: [set(30, 12)],
    })
    expect(next.entries[0]).toMatchObject({ exerciseId: 'new', restSec: 120, plan: { sets: 3 } })
    expect(next.entries[0].sets).toEqual([set(30, 12), set(30, 12), set(30, 12)])
  })
})

describe('«Сегодня»: выбор дня и нагрузки', () => {
  it('можно выбрать другой день программы и начать его в лёгком варианте', async () => {
    const repos = await withProgram()
    const { user, router } = renderAt('/', repos)
    const days = await screen.findByRole('group', { name: 'День программы' })
    expect(within(days).getByRole('button', { name: 'Верх' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(days).getByRole('button', { name: 'Низ' }))
    expect(await screen.findByText('Приседания со штангой')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Лёгкая −20%' }))
    await user.click(screen.getByRole('button', { name: 'Начать: Низ · лёгкий' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    const w = await repos.workouts.getActive()
    expect(w?.name).toBe('Низ · лёгкий')
    expect(w?.entries[0].sets[0].weightKg).toBe(80)
  })
})

describe('тренировка: техника, история, замена', () => {
  it('у каждого упражнения — техника с видео, история прошлых раз и замена', async () => {
    const repos = await setup()
    const past = await repos.workouts.start(null)
    past.entries.push(await repos.workouts.buildEntry('builtin-bench-press', null))
    past.entries[0].sets = [{ weightKg: 60, reps: 10, done: true }]
    await repos.workouts.save(past)
    await repos.workouts.finish(past.id)
    const w = await repos.workouts.start(null)
    w.entries.push(await repos.workouts.buildEntry('builtin-bench-press', null, w.id))
    await repos.workouts.save(w)

    const { user } = renderAt('/workout', repos)
    await user.click(await screen.findByRole('button', { name: /^Жим штанги лёжа —/ }))
    const region = await screen.findByRole('dialog', { name: 'Жим штанги лёжа' })

    await user.click(within(region).getByRole('button', { name: 'Техника: Жим штанги лёжа' }))
    // справка открывается поверх шторки упражнения — она последняя
    const sheet = screen.getAllByRole('dialog', { name: 'Жим штанги лёжа' }).at(-1)!
    // рисунки начала и конца движения — без интернета
    const frames = within(sheet).getByRole('figure', { name: 'Техника: Жим штанги лёжа' })
    expect(
      within(frames)
        .getAllByRole('img')
        .map((i) => i.getAttribute('src')),
    ).toEqual([
      expect.stringContaining('drawings/bench-press-0.webp'),
      expect.stringContaining('drawings/bench-press-1.webp'),
    ])
    expect(within(sheet).getByRole('list', { name: 'Ключевые моменты' })).toHaveTextContent(
      'Лопатки сведены',
    )
    expect(within(sheet).getByRole('link', { name: 'Найти в Яндексе' })).toHaveAttribute(
      'href',
      expect.stringContaining('yandex.ru/images/search'),
    )

    await user.click(within(sheet).getByRole('button', { name: 'История' }))
    const history = await within(sheet).findByRole('list', { name: 'Прошлые тренировки' })
    expect(history).toHaveTextContent('60 × 10')
    await user.click(within(sheet).getByRole('button', { name: 'Закрыть' }))

    await user.click(within(region).getByRole('button', { name: 'Заменить «Жим штанги лёжа»' }))
    const picker = screen.getByRole('dialog', { name: 'Заменить на' })
    await user.type(within(picker).getByRole('searchbox'), 'гантелей лёжа')
    await user.click(within(picker).getByRole('button', { name: /Жим гантелей лёжа/ }))
    expect(await screen.findByRole('dialog', { name: 'Жим гантелей лёжа' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Жим штанги лёжа —/ })).not.toBeInTheDocument()
    await waitFor(async () =>
      expect((await repos.workouts.getActive())?.exerciseIds).toEqual(['builtin-db-bench-press']),
    )
  })

  it('подсказки есть у базовых, у своих — нет; видео пока нет ни у одного', () => {
    expect(techniqueCues({ id: 'builtin-squat' }).length).toBeGreaterThan(0)
    expect(techniqueCues({ id: 'my-own' })).toEqual([])
    expect(techniqueImages({ id: 'builtin-squat' })?.frames[1]).toMatch(/drawings\/squat-1\.webp$/)
    expect(techniqueImages({ id: 'builtin-burpee' })).toBeNull()
    expect(techniqueSearchUrl({ name: 'Присед' })).toContain(
      encodeURIComponent('Присед техника мышцы'),
    )
  })
})

describe('боты', () => {
  it('в дневнике и настройках — Telegram и MAX, пока неактивны с пометкой «Скоро»', async () => {
    const repos = await setup()
    const { user } = renderAt('/food', repos)
    const bots = await screen.findByRole('region', { name: 'Боты' })
    expect(within(bots).getByText('Скоро')).toBeInTheDocument()
    expect(within(bots).getByRole('button', { name: 'Telegram — скоро' })).toBeDisabled()
    expect(within(bots).getByRole('button', { name: 'MAX — скоро' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Ещё' }))
    const more = screen.getByRole('dialog', { name: 'Ещё' })
    expect(within(more).getByRole('region', { name: 'Боты' })).toBeInTheDocument()
    await user.click(within(more).getByRole('button', { name: /^Настройки/ }))
    expect(await screen.findByRole('region', { name: 'Telegram и MAX' })).toBeInTheDocument()
  })

  it('старые адреса веса ведут в «Прогресс» → «Вес тела»', async () => {
    const { router } = renderAt('/body', await setup())
    await waitFor(() => expect(router.state.location.pathname).toBe('/progress'))
    expect(router.state.location.search).toBe('?view=weight')
  })
})

describe('инструкция', () => {
  it('открывается из меню «Ещё» и из настроек, разделы раскрываются', async () => {
    const { user, router } = renderAt('/', await setup())
    await user.click(await screen.findByRole('button', { name: 'Ещё' }))
    await user.click(await screen.findByRole('button', { name: /^Как пользоваться/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/help'))
    expect(screen.getByRole('heading', { name: 'Как пользоваться' })).toBeInTheDocument()
    expect(screen.getByText('С чего начать').closest('details')).toHaveAttribute('open')
    const food = screen.getByText('Питание', { selector: 'summary' }).closest('details')!
    expect(food).not.toHaveAttribute('open')
    await user.click(screen.getByText('Питание', { selector: 'summary' }))
    expect(food).toHaveAttribute('open')

    await user.click(screen.getByRole('button', { name: 'Назад' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await user.click(screen.getByRole('button', { name: 'Ещё' }))
    await user.click(await screen.findByRole('button', { name: /^Настройки/ }))
    await screen.findByRole('heading', { name: 'Настройки' })
    await user.click(screen.getByRole('button', { name: 'Как пользоваться' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/help'))
  })
})
