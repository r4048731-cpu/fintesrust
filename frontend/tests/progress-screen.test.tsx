// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import type { WorkoutSet } from '../src/domain/types'
import { DAY, setup } from './helpers'

type Repos = Awaited<ReturnType<typeof setup>>
const done = (weightKg: number, reps: number): WorkoutSet => ({ weightKg, reps, done: true })

async function log(r: Repos, entries: [string, WorkoutSet[]][], daysLater: number) {
  r.clock.advance(daysLater * DAY)
  const w = await r.workouts.start(null)
  for (const [id, sets] of entries) {
    const e = await r.workouts.buildEntry(id, null)
    w.entries.push({ ...e, sets })
  }
  await r.workouts.save(w)
  await r.workouts.finish(w.id)
}

function renderAt(path: string, repos: Repos) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <DataProvider repos={repos}>
      <RouterProvider router={router} />
    </DataProvider>,
  )
  return { router, user: userEvent.setup() }
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
/** «25 сен» для даты `daysAgo` дней назад: экран считает статистику от настоящего «сегодня». */
function ago(daysAgo: number) {
  const n = new Date()
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - daysAgo, 18)
  return { date: d, label: `${d.getDate()} ${MONTHS[d.getMonth()]}` }
}

/** Жим в трёх тренировках (11 и 7 дней назад и сегодня) и подтягивания в одной. */
async function withHistory() {
  const r = await setup()
  r.clock.set(ago(11).date)
  await log(r, [['builtin-bench-press', [done(60, 10), done(60, 8)]]], 0)
  await log(
    r,
    [
      ['builtin-bench-press', [done(62.5, 8)]],
      ['builtin-pull-up', [done(0, 8)]],
    ],
    4,
  )
  await log(r, [['builtin-bench-press', [done(65, 6)]]], 7)
  return r
}

describe('прогресс', () => {
  it('без тренировок — пояснение', async () => {
    renderAt('/progress', await setup())
    expect(await screen.findByText('Графиков пока нет')).toBeInTheDocument()
  })

  it('по умолчанию самое частое упражнение: рекорды, график, таблица', async () => {
    renderAt('/progress', await withHistory())
    const select = await screen.findByRole('combobox', { name: 'Упражнение' })
    expect(select).toHaveDisplayValue('Жим штанги лёжа · 3')
    expect(screen.getByText('Макс. вес').nextSibling).toHaveTextContent('65 кг')
    // 1ПМ: 60 × 10 → 80 кг — больше, чем 65 × 6 → 78
    expect(screen.getByText('Расч. 1ПМ').nextSibling).toHaveTextContent('80 кг')
    expect(screen.getByText('Лучший подход').nextSibling).toHaveTextContent('60 × 10')
    expect(
      screen.getByRole('img', {
        name: /Жим штанги лёжа: Лучший вес и Расчётный 1ПМ по 3 тренировкам/,
      }),
    ).toBeInTheDocument()

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual([
      '25 сен65 × 678',
      '18 сен62,5 × 879',
      '14 сен60 × 10, 60 × 880',
    ])
  })

  it('стрелки клавиатуры показывают значения тренировки на графике', async () => {
    const { user } = renderAt('/progress', await withHistory())
    const chart = await screen.findByRole('img', { name: /Лучший вес/ })
    chart.focus()
    await user.keyboard('{ArrowLeft}')
    const tip = screen.getByRole('status')
    expect(tip).toHaveTextContent(ago(7).label)
    expect(tip).toHaveTextContent('Лучший вес: 62,5')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('смена упражнения; одна тренировка — вместо линии пояснение', async () => {
    const { user, router } = renderAt('/progress', await withHistory())
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Упражнение' }),
      'builtin-pull-up',
    )
    expect(router.state.location.search).toBe('?ex=builtin-pull-up')
    expect(screen.getByText('Макс. повторов').nextSibling).toHaveTextContent('8')
    expect(screen.getByText(/Линия появится после второй/)).toBeInTheDocument()
  })

  it('общая статистика и тоннаж по неделям', async () => {
    renderAt('/progress', await withHistory())
    await screen.findByText('Все тренировки')
    expect(screen.getByText('За 7 дней').nextSibling).toHaveTextContent('1')
    expect(screen.getByText('За 30 дней').nextSibling).toHaveTextContent('3')
    expect(
      screen.getByRole('img', { name: /Тоннаж по неделям за 10 недель, текущая неделя: 390 кг/ }),
    ).toBeInTheDocument()
  })

  it('«Сегодня» показывает короткую статистику и ведёт в прогресс', async () => {
    const r = await withHistory()
    const { user, router } = renderAt('/', r)
    const stats = await screen.findByRole('button', { name: /За 7 дней/ })
    expect(stats).toHaveTextContent('Всего3')
    await user.click(stats)
    await waitFor(() => expect(router.state.location.pathname).toBe('/progress'))
  })
})
