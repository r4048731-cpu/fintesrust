// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { best1RMSet, oneRMTable, repsAtPercent } from '../src/domain/oneRM'
import type { WorkoutSet } from '../src/domain/types'
import { setup } from './helpers'

type Repos = Awaited<ReturnType<typeof setup>>
const done = (weightKg: number, reps: number): WorkoutSet => ({ weightKg, reps, done: true })

describe('таблица 1ПМ', () => {
  it('проценты от максимума, округлённые до шага', () => {
    const rows = oneRMTable(100, 2.5)
    expect(rows.map((r) => r.percent)).toEqual([100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50])
    expect(rows[0]).toEqual({ percent: 100, weightKg: 100, reps: 1, zone: 'max' })
    expect(rows.find((r) => r.percent === 85)).toMatchObject({ weightKg: 85, zone: 'strength' })
    expect(rows.find((r) => r.percent === 75)).toMatchObject({ weightKg: 75, zone: 'mass' })
    expect(rows.at(-1)).toMatchObject({ weightKg: 50, zone: 'light' })
    // 93,3 × 0,95 = 88,6 → до шага 2,5 выходит 87,5
    expect(oneRMTable(93.3, 2.5)[1].weightKg).toBe(87.5)
    expect(oneRMTable(0, 2.5)).toEqual([])
  })

  it('повторы — обратная формула Эпли', () => {
    expect(repsAtPercent(100)).toBe(1)
    expect(repsAtPercent(90)).toBe(3)
    expect(repsAtPercent(75)).toBe(10)
    expect(repsAtPercent(50)).toBe(30)
  })

  it('лучший подход — с самым большим расчётным максимумом, а не самым тяжёлым весом', () => {
    expect(best1RMSet([done(65, 6), done(60, 10), done(62.5, 8)])).toEqual(done(60, 10))
    expect(best1RMSet([done(0, 10)])).toBeNull()
  })
})

async function withBench() {
  const r = await setup()
  const w = await r.workouts.start(null)
  const e = await r.workouts.buildEntry('builtin-bench-press', null)
  w.entries.push({ ...e, sets: [done(65, 6), done(60, 10)] })
  await r.workouts.save(w)
  await r.workouts.finish(w.id)
  return r
}

function renderAt(path: string, repos: Repos) {
  render(
    <DataProvider repos={repos}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </DataProvider>,
  )
  return userEvent.setup()
}

describe('калькулятор 1ПМ на экране', () => {
  it('из «Прогресса» открывается по лучшему подходу и пересчитывается', async () => {
    const user = renderAt('/progress?view=charts', await withBench())
    await user.click(await screen.findByRole('button', { name: /Расч\. 1ПМ/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Калькулятор 1ПМ' })
    // 60 × 10 → 60 × (1 + 10/30) = 80
    expect(within(sheet).getByRole('status')).toHaveTextContent('80 кг')
    const row = within(sheet).getByRole('row', { name: /^90%/ })
    expect(row).toHaveTextContent('72,5 кг')

    const reps = within(sheet).getByLabelText('Повторы')
    await user.clear(reps)
    await user.type(reps, '15{Enter}')
    expect(within(sheet).getByRole('status')).toHaveTextContent('90 кг')
    expect(within(sheet).getByRole('status')).toHaveTextContent('завышает')
  })

  it('общий калькулятор в меню «Ещё»', async () => {
    const user = renderAt('/', await setup())
    await user.click(await screen.findByRole('button', { name: 'Ещё' }))
    await user.click(screen.getByRole('button', { name: /Калькулятор 1ПМ/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Калькулятор 1ПМ' })
    // Пример по умолчанию: 60 × 5 = 70
    expect(within(sheet).getByRole('status')).toHaveTextContent('70 кг')
    expect(within(sheet).getAllByRole('row')).toHaveLength(12)
  })
})
