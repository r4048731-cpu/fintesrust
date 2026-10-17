// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { builtinExercises } from '../src/data/seed'
import { muscleWork } from '../src/domain/muscles'
import { techniqueImages } from '../src/domain/technique'
import { setup } from './helpers'

describe('картинки техники', () => {
  it('у каждой картинки из списков есть файл; картинки есть у большинства упражнений', () => {
    // файлы в public/technique — список собирает Vite при запуске тестов
    const files = new Set(
      Object.keys(import.meta.glob('../public/technique/*/*.webp')).map((f) =>
        f.split('/').slice(-2).join('/'),
      ),
    )
    const withImages = builtinExercises(0).filter((e) => techniqueImages(e))
    for (const e of withImages) {
      for (const src of techniqueImages(e)!.frames) {
        expect(files.has(src.split('/').slice(-2).join('/')), src).toBe(true)
      }
    }
    expect(withImages.length).toBeGreaterThanOrEqual(104)
    // рисунок важнее фото; у бокса картинок нет
    expect(techniqueImages({ id: 'builtin-squat' })?.kind).toBe('drawing')
    expect(techniqueImages({ id: 'builtin-plank' })?.kind).toBe('photo')
    // бокс — фото из наставления; у мешка один кадр
    expect(techniqueImages({ id: 'builtin-shadow-boxing' })?.kind).toBe('boxing')
    expect(techniqueImages({ id: 'builtin-heavy-bag' })?.frames).toHaveLength(1)
    expect(techniqueImages({ id: 'builtin-burpee' })).toBeNull()
  })

  it('мышцы: есть почти у всех, слои на нужной стороне тела, файлы на месте', () => {
    const files = new Set(
      Object.keys(import.meta.glob('../public/technique/muscles/*')).map((f) => f.split('/').pop()),
    )
    const all = builtinExercises(0)
    const missing = all.filter((e) => !muscleWork(e)).map((e) => e.id)
    // на схеме нет предплечий и приводящих мышц
    expect(missing).toEqual(['builtin-hip-adduction', 'builtin-wrist-curl'])
    for (const e of all) {
      const w = muscleWork(e)
      if (!w) continue
      expect(w.main.length, e.id).toBeGreaterThan(0)
      for (const src of [...w.layers.front, ...w.layers.back]) {
        expect(files.has(src.split('/').pop()), src).toBe(true)
      }
    }
    // жим лёжа: грудь красная спереди, трицепс оранжевый сзади
    const bench = muscleWork({ id: 'builtin-bench-press' })!
    expect(bench.layers.front[0]).toMatch(/main-4\.svg$/)
    expect(bench.layers.back).toEqual([expect.stringMatching(/secondary-5\.svg$/)])
    // у бокса картинок нет, а мышцы есть
    expect(muscleWork({ id: 'builtin-shadow-boxing' })?.main).toEqual(['delts', 'obliques'])
  })

  it('в карточке два положения рядом и подпись источника', async () => {
    const r = await setup()
    const router = createMemoryRouter(routes, { initialEntries: ['/programs/exercises'] })
    render(
      <DataProvider repos={r}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    await user.type(await screen.findByRole('searchbox'), 'разгибания ног')
    await user.click(screen.getByRole('button', { name: /^Разгибания ног в тренажёре/ }))
    const card = screen.getByRole('dialog', { name: 'Разгибания ног в тренажёре' })
    const figure = within(card).getByRole('figure', { name: 'Техника: Разгибания ног в тренажёре' })
    expect(
      within(figure)
        .getAllByRole('img')
        .map((i) => i.getAttribute('alt')),
    ).toEqual(['Начало движения', 'Конец движения'])
    expect(figure).toHaveTextContent('CC BY-SA 4.0')
    const muscles = within(card).getByRole('figure', { name: 'Какие мышцы работают' })
    expect(muscles).toHaveTextContent('Основные: квадрицепс')
    expect(
      within(muscles)
        .getAllByRole('img')
        .map((i) => i.getAttribute('aria-label')),
    ).toEqual(['Спереди', 'Сзади'])
    // своего видео больше нет
    expect(within(card).queryByRole('button', { name: /видео/ })).not.toBeInTheDocument()
  })
})
