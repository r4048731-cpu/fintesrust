// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { createBackup, parseBackup, restoreBackup } from '../src/data/backup'
import { measureSeries, measureTrend, waistToHeight } from '../src/data/repositories/measurements'
import { toISODate } from '../src/domain/metrics'
import { DAY, setup } from './helpers'

describe('замеры тела: хранение', () => {
  it('одна запись на день, пустые замеры не сохраняются, пределы', async () => {
    const r = await setup()
    await r.measurements.record({ waist: 84.04, chest: 0, biceps: null })
    const [row] = await r.measurements.list()
    expect(row.values).toEqual({ waist: 84 })
    expect(row.date).toBe(toISODate(new Date(r.clock())))

    await r.measurements.record({ waist: 83.5, hips: 98 })
    expect(await r.measurements.list()).toMatchObject([{ values: { waist: 83.5, hips: 98 } }])

    await expect(r.measurements.record({ waist: 0 })).rejects.toThrow('хотя бы один')
    await expect(r.measurements.record({ waist: 400 })).rejects.toThrow('от 10 до 250 см')

    await r.measurements.remove(row.id)
    expect(await r.measurements.list()).toEqual([])
  })

  it('ряд и изменение по одному замеру — только записи, где он есть', async () => {
    const r = await setup()
    await r.measurements.record({ waist: 86, chest: 100 }, '2026-08-01')
    await r.measurements.record({ chest: 101 }, '2026-08-15')
    await r.measurements.record({ waist: 83.5 }, '2026-09-01')
    const rows = await r.measurements.list()
    expect(measureSeries(rows, 'waist')).toEqual([
      { date: '2026-08-01', cm: 86 },
      { date: '2026-09-01', cm: 83.5 },
    ])
    expect(measureTrend(rows, 'waist')).toEqual({ cm: 83.5, change: -2.5 })
    expect(measureTrend(rows, 'chest')).toEqual({ cm: 101, change: 1 })
    expect(measureTrend(rows, 'biceps')).toBeNull()
    expect(waistToHeight(83.5, 180)).toBe(0.46)
  })

  it('замеры попадают в резервную копию; старая копия без них восстанавливается', async () => {
    const r = await setup()
    await r.measurements.record({ waist: 80 })
    const backup = await createBackup(r.db, 0)
    expect(backup.measurements).toHaveLength(1)
    const target = await setup()
    await restoreBackup(target.db, parseBackup(JSON.stringify(backup)))
    expect(await target.measurements.list()).toMatchObject([{ values: { waist: 80 } }])
    const { measurements: _, ...old } = backup
    void _
    await restoreBackup(target.db, parseBackup(JSON.stringify({ ...old, schemaVersion: 7 })))
    expect(await target.measurements.list()).toEqual([])
  })
})

describe('раздел «Вес»: замеры', () => {
  async function openWeight(fill?: (r: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
    const r = await setup()
    r.clock.set(new Date())
    await fill?.(r)
    const router = createMemoryRouter(routes, { initialEntries: ['/progress?view=weight'] })
    render(
      <DataProvider repos={r}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    return { r, user: userEvent.setup() }
  }

  it('первая запись: заполнить талию и сохранить', async () => {
    const { r, user } = await openWeight()
    await user.click(await screen.findByRole('button', { name: 'Записать замеры' }))
    const sheet = await screen.findByRole('dialog', { name: 'Новые замеры' })
    const waist = within(sheet).getByRole('textbox', { name: 'Талия, см' })
    await user.click(waist)
    await user.keyboard('{Control>}a{/Control}82,5{Enter}')
    await user.click(within(sheet).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () =>
      expect(await r.measurements.list()).toMatchObject([{ values: { waist: 82.5 } }]),
    )
    const list = await screen.findByRole('list', { name: 'Замеры по датам' })
    expect(list).toHaveTextContent('Талия 82,5')
  })

  it('плитки с изменением, талия / рост, правка прошлой записи', async () => {
    const { r, user } = await openWeight(async (r) => {
      await r.meta.set('bodyProfile', {
        sex: 'male',
        age: 30,
        heightCm: 180,
        activity: 'moderate',
        goal: 'lose',
      })
      await r.measurements.record(
        { waist: 88, biceps: 35 },
        toISODate(new Date(r.clock() - 30 * DAY)),
      )
      await r.measurements.record({ waist: 85.5, biceps: 36 })
    })
    const tiles = await screen.findByRole('group', { name: 'Замер для графика' })
    const waistTile = within(tiles).getByRole('button', { name: /Талия/ })
    expect(waistTile).toHaveAttribute('aria-pressed', 'true')
    expect(waistTile).toHaveTextContent('85,5 см−2,5 см')
    expect(within(tiles).getByRole('button', { name: /Бицепс/ })).toHaveTextContent('+1 см')
    expect(screen.getByText(/Талия \/ рост/).parentElement).toHaveTextContent('0,48')
    expect(screen.getByRole('img', { name: /Талия по 2 замерам/ })).toBeInTheDocument()

    await user.click(within(tiles).getByRole('button', { name: /Грудь/ }))
    expect(screen.getByText(/График «грудь» появится после второго замера/)).toBeInTheDocument()

    const [latest] = within(screen.getByRole('list', { name: 'Замеры по датам' })).getAllByRole(
      'button',
    )
    await user.click(latest)
    const sheet = await screen.findByRole('dialog', { name: /Замеры за/ })
    expect(within(sheet).getByRole('textbox', { name: 'Талия, см' })).toHaveValue('85,5')
    await user.click(within(sheet).getByRole('button', { name: 'Удалить' }))
    await waitFor(async () => expect(await r.measurements.list()).toHaveLength(1))
  })
})
