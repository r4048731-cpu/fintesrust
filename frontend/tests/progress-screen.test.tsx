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
  it('без тренировок и веса — пояснение', async () => {
    renderAt('/progress?view=charts', await setup())
    expect(await screen.findByText('Графиков упражнений пока нет')).toBeInTheDocument()
  })

  it('«Графики» собирают все графики: без тренировок, но с весом — график веса', async () => {
    const r = await setup()
    r.clock.set(new Date())
    await r.bodyWeights.record(82)
    r.clock.advance(DAY)
    await r.bodyWeights.record(81)
    renderAt('/progress?view=charts', r)
    expect(await screen.findByRole('heading', { name: 'Тело' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Вес тела, кг: 2 точек/ })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Период графиков' })).toHaveDisplayValue(
      'Всё время',
    )
  })

  it('по умолчанию самое частое упражнение: рекорды, «Рабочий вес», таблица', async () => {
    renderAt('/progress?view=charts', await withHistory())
    const select = await screen.findByRole('combobox', { name: 'Упражнение' })
    expect(select).toHaveDisplayValue('Жим штанги лёжа · 3')
    expect(screen.getByText('Макс. вес').nextSibling).toHaveTextContent('65 кг')
    // 1ПМ: 60 × 10 → 80 кг — больше, чем 65 × 6 → 78
    expect(screen.getByText('Расч. 1ПМ').nextSibling).toHaveTextContent('80 кг')
    expect(screen.getByText('Лучший подход').nextSibling).toHaveTextContent('60 × 10')

    const switcher = screen.getByRole('group', { name: 'График' })
    expect(
      within(switcher)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Рабочий вес', '1ПМ', 'Подходы'])
    expect(within(switcher).getByRole('button', { name: 'Рабочий вес' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByRole('img', { name: /Рабочий вес, кг, Жим штанги лёжа: 3 точки/ }),
    ).toBeInTheDocument()
    // ниже — все остальные графики, в том числе тоннаж по неделям
    expect(
      await screen.findByRole('heading', { name: 'Тоннаж по неделям, кг' }),
    ).toBeInTheDocument()

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual([
      `${ago(0).label}65 × 665`,
      `${ago(7).label}62,5 × 862,5`,
      `${ago(11).label}60 × 10, 60 × 860`,
    ])
  })

  it('подсказка на графике: рабочий вес и подходы тренировки', async () => {
    const { user } = renderAt('/progress?view=charts', await withHistory())
    const chart = await screen.findByRole('img', { name: /Рабочий вес/ })
    chart.focus()
    await user.keyboard('{ArrowLeft}')
    const tip = screen.getByRole('status')
    expect(tip).toHaveTextContent(ago(7).label)
    expect(tip).toHaveTextContent('Рабочий вес: 62,5')
    expect(tip).toHaveTextContent('62,5 × 8')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('«Подходы» — повторов за тренировку, в подсказке подходы', async () => {
    const { user, router } = renderAt('/progress?view=charts', await withHistory())
    await user.click(await screen.findByRole('button', { name: 'Подходы' }))
    expect(router.state.location.search).toContain('chart=sets')
    const chart = screen.getByRole('img', { name: /Повторов за тренировку/ })
    chart.focus()
    await user.keyboard('{Home}{ArrowLeft}{ArrowLeft}')
    const tip = screen.getByRole('status')
    expect(tip).toHaveTextContent('Повторов: 18')
    expect(tip).toHaveTextContent('2 подхода: 10, 8')
  })

  it('раздел «Тело» — панель веса, выбор хранится в адресе', async () => {
    const r = await withHistory()
    r.clock.set(ago(3).date)
    await r.bodyWeights.record(81)
    r.clock.set(ago(1).date)
    await r.bodyWeights.record(82, 'later')
    const { user, router } = renderAt('/progress', r)
    await user.click(await screen.findByRole('button', { name: 'Тело' }))
    expect(router.state.location.search).toContain('view=weight')
    expect(await screen.findByRole('img', { name: /Вес тела по 2 записям/ })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Вес по дням' })).toBeInTheDocument()
  })

  it('для подтягиваний «Рабочего веса» нет; одна тренировка — пояснение', async () => {
    const { user, router } = renderAt('/progress?view=charts', await withHistory())
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Упражнение' }),
      'builtin-pull-up',
    )
    expect(router.state.location.search).toContain('ex=builtin-pull-up')
    expect(screen.getByText('Макс. повторов').nextSibling).toHaveTextContent('8')
    expect(screen.queryByRole('button', { name: 'Рабочий вес' })).not.toBeInTheDocument()
    expect(screen.getByText(/Линия появится после второй/)).toBeInTheDocument()
  })

  it('только вес тела, без тренировок — открывается график веса', async () => {
    const r = await setup()
    r.clock.set(ago(2).date)
    await r.bodyWeights.record(80)
    r.clock.set(ago(0).date)
    await r.bodyWeights.record(79.5)
    renderAt('/progress', r)
    expect(await screen.findByRole('img', { name: /Вес тела по 2 записям/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Тело' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('общая статистика', async () => {
    renderAt('/progress?view=charts', await withHistory())
    await screen.findByText('Все тренировки')
    expect(screen.getByText('За 7 дней').nextSibling).toHaveTextContent('1')
    expect(screen.getByText('За 30 дней').nextSibling).toHaveTextContent('3')
    expect(screen.getByText('Всего').nextSibling).toHaveTextContent('3')
  })

  it('«Сегодня» показывает неделю и ведёт в прогресс', async () => {
    const r = await withHistory()
    const { user, router } = renderAt('/', r)
    const week = await screen.findByRole('region', { name: 'Эта неделя' })
    // сегодня была тренировка: день залит, в сводке одна тренировка за неделю
    expect(within(week).getByRole('button', { name: /сегодня/ })).toHaveAccessibleName(
      /была тренировка, сегодня/,
    )
    const summary = within(week).getByRole('button', { name: 'Эта неделя — открыть прогресс' })
    expect(summary).toHaveTextContent('1 тренировка')
    await user.click(summary)
    await waitFor(() => expect(router.state.location.pathname).toBe('/progress'))
  })
})
