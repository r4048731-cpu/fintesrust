// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { setup } from './helpers'

async function renderAt(path: string, repos?: Awaited<ReturnType<typeof setup>>) {
  const r = repos ?? (await setup())
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <DataProvider repos={r}>
      <RouterProvider router={router} />
    </DataProvider>,
  )
  return { repos: r, router, user: userEvent.setup() }
}

/** Дождаться, пока автосохранение запишет программу в базу. */
const saved = async (repos: Awaited<ReturnType<typeof setup>>, id: string) =>
  (await repos.programs.get(id))!

describe('программы', () => {
  it('создание с пустого экрана открывает редактор, первая программа активная', async () => {
    const { user, router, repos } = await renderAt('/programs')
    await user.click(await screen.findByRole('button', { name: 'Создать программу' }))
    await screen.findByRole('textbox', { name: 'Название дня' })
    expect(router.state.location.pathname).toMatch(/^\/programs\/.+/)
    expect(await screen.findByText('Активная')).toBeInTheDocument()
    expect((await repos.programs.list()).length).toBe(1)
  })

  it('собирает день: название, упражнение, подходы, вес — и сохраняет сам', async () => {
    const repos = await setup()
    const p = await repos.programs.create('Новая программа')
    const { user } = await renderAt(`/programs/${p.id}`, repos)

    const name = await screen.findByRole('textbox', { name: 'Название' })
    await user.clear(name)
    await user.type(name, 'Верх/Низ')
    const dayName = screen.getByRole('textbox', { name: 'Название дня' })
    await user.clear(dayName)
    await user.type(dayName, 'Верх')

    await user.click(screen.getByRole('button', { name: 'Упражнение' }))
    const picker = screen.getByRole('dialog', { name: 'Добавить упражнение' })
    await user.type(within(picker).getByRole('searchbox'), 'жим штанги')
    await user.click(within(picker).getByRole('button', { name: /Жим штанги лёжа/ }))

    // новое упражнение сразу раскрыто для правки
    await user.click(screen.getByRole('button', { name: 'Подходы: увеличить на 1' }))
    await user.click(screen.getByRole('button', { name: 'Вес, кг: увеличить на 2,5' }))
    await user.click(screen.getByRole('button', { name: 'Вес, кг: увеличить на 2,5' }))
    expect(screen.getByText('4 × 8–12 · 5 кг · отдых 1:30')).toBeInTheDocument()

    await waitFor(async () => {
      const s = await saved(repos, p.id)
      expect(s.name).toBe('Верх/Низ')
      expect(s.days[0]).toMatchObject({
        name: 'Верх',
        items: [
          { exerciseId: 'builtin-bench-press', sets: 4, weightKg: 5, repsMin: 8, repsMax: 12 },
        ],
      })
    })
    expect(await screen.findByText('Сохранено')).toBeInTheDocument()
  })

  it('дни: добавить, копировать, переставить, удалить с подтверждением', async () => {
    const repos = await setup()
    const p = await repos.programs.create('П')
    p.days[0].name = 'Верх'
    p.days[0].items = [
      { exerciseId: 'builtin-squat', sets: 3, repsMin: 5, repsMax: 5, weightKg: 100, restSec: 120 },
    ]
    await repos.programs.save(p)
    const { user } = await renderAt(`/programs/${p.id}`, repos)

    await user.click(await screen.findByRole('button', { name: 'Копировать день' }))
    await user.click(screen.getByRole('button', { name: 'Добавить день' }))
    const names = () =>
      screen
        .getAllByRole('textbox', { name: 'Название дня' })
        .map((i) => (i as HTMLInputElement).value)
    expect(names()).toEqual(['Верх', 'Верх (копия)', 'День C'])

    await user.click(screen.getByRole('button', { name: 'Поднять «День C» выше' }))
    expect(names()).toEqual(['Верх', 'День C', 'Верх (копия)'])

    // пустой день удаляется сразу, день с упражнениями — после подтверждения
    const dayC = screen.getByRole('region', { name: 'День C' })
    await user.click(within(dayC).getByRole('button', { name: 'Удалить день' }))
    expect(names()).toEqual(['Верх', 'Верх (копия)'])
    const copy = screen.getByRole('region', { name: 'Верх (копия)' })
    await user.click(within(copy).getByRole('button', { name: 'Удалить день' }))
    await user.click(within(copy).getByRole('button', { name: 'Удалить день' }))
    expect(names()).toEqual(['Верх'])
    // последний день удалить нельзя — кнопки нет
    expect(screen.queryByRole('button', { name: 'Удалить день' })).not.toBeInTheDocument()

    await waitFor(async () => expect((await saved(repos, p.id)).days).toHaveLength(1))
  })

  it('упражнения внутри дня переставляются и убираются', async () => {
    const repos = await setup()
    const p = await repos.programs.create('П')
    p.days[0].items = [
      { exerciseId: 'builtin-squat', sets: 3, repsMin: 5, repsMax: 5, weightKg: 100, restSec: 120 },
      {
        exerciseId: 'builtin-leg-press',
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        weightKg: 150,
        restSec: 90,
      },
    ]
    await repos.programs.save(p)
    const { user } = await renderAt(`/programs/${p.id}`, repos)

    await user.click(await screen.findByRole('button', { name: /Жим ногами/ }))
    await user.click(screen.getByRole('button', { name: 'Выше' }))
    await waitFor(async () =>
      expect((await saved(repos, p.id)).days[0].items.map((i) => i.exerciseId)).toEqual([
        'builtin-leg-press',
        'builtin-squat',
      ]),
    )
    await user.click(screen.getByRole('button', { name: 'Убрать из дня' }))
    await waitFor(async () =>
      expect((await saved(repos, p.id)).days[0].items.map((i) => i.exerciseId)).toEqual([
        'builtin-squat',
      ]),
    )
  })

  it('активная программа, копия и удаление', async () => {
    const repos = await setup()
    const first = await repos.programs.create('Первая')
    const second = await repos.programs.create('Вторая')
    const { user, router } = await renderAt(`/programs/${second.id}`, repos)

    await user.click(await screen.findByRole('button', { name: 'Сделать активной' }))
    expect(await screen.findByText('Активная')).toBeInTheDocument()
    expect((await repos.programs.getActive())?.id).toBe(second.id)

    await user.click(screen.getByRole('button', { name: 'Копировать программу' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Вторая (копия)' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Удалить программу' }))
    await user.click(screen.getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/programs'))
    const list = await screen.findByRole('list', { name: 'Программы' })
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([expect.stringContaining('Вторая'), expect.stringContaining('Первая')])
    expect(first.id).toBeTruthy()
  })

  it('«Сегодня» показывает план следующего дня', async () => {
    const repos = await setup()
    const p = await repos.programs.create('Верх/Низ')
    p.days[0].name = 'Верх'
    p.days[0].items = [
      {
        exerciseId: 'builtin-bench-press',
        sets: 3,
        repsMin: 8,
        repsMax: 10,
        weightKg: 60,
        restSec: 90,
      },
    ]
    await repos.programs.save(p)
    await renderAt('/', repos)
    expect(await screen.findByRole('heading', { name: 'Верх' })).toBeInTheDocument()
    expect(screen.getByText('Жим штанги лёжа')).toBeInTheDocument()
    expect(screen.getByText('3 × 8–10 · 60 кг · отдых 1:30')).toBeInTheDocument()
  })

  it('несуществующая программа', async () => {
    await renderAt('/programs/nope')
    expect(await screen.findByText('Программа не найдена')).toBeInTheDocument()
  })
})
