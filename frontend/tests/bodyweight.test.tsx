// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dexie } from 'dexie'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { createBackup, parseBackup, restoreBackup } from '../src/data/backup'
import { FitnessDB } from '../src/data/db'
import { bodyWeightChange } from '../src/data/repositories/bodyWeights'
import { toISODate } from '../src/domain/metrics'
import { DAY, setup } from './helpers'

describe('вес тела: хранение', () => {
  it('одна запись на день, повторная заменяет; пределы; удаление', async () => {
    const r = await setup()
    await r.bodyWeights.record(80.44)
    await r.bodyWeights.record(80.2)
    r.clock.advance(DAY)
    await r.bodyWeights.record(79.9)
    const rows = await r.bodyWeights.list()
    expect(rows.map((x) => x.weightKg)).toEqual([80.2, 79.9])
    await expect(r.bodyWeights.record(5)).rejects.toThrow('от 20 до 400')
    await r.bodyWeights.remove(rows[0].id)
    expect((await r.bodyWeights.list()).map((x) => x.weightKg)).toEqual([79.9])
  })

  it('изменение за 30 дней считается по окну', () => {
    const row = (date: string, weightKg: number) => ({
      id: date,
      date,
      weightKg,
      updatedAt: 0,
      deletedAt: null,
    })
    const rows = [row('2026-07-01', 90), row('2026-09-01', 82), row('2026-09-20', 80.5)]
    expect(bodyWeightChange(rows, 30, '2026-09-25')).toBe(-1.5)
    expect(bodyWeightChange(rows.slice(2), 30, '2026-09-25')).toBeNull()
  })

  it('обновление базы с версии 1 сохраняет тренировки и добавляет таблицу веса', async () => {
    const name = `migrate-${crypto.randomUUID()}`
    const v1 = new Dexie(name)
    v1.version(1).stores({
      exercises: 'id, muscle, name, updatedAt',
      programs: 'id, updatedAt',
      workouts: 'id, date, status, *exerciseIds, updatedAt',
      meta: 'key',
    })
    await v1
      .table('workouts')
      .add({ id: 'w1', date: '2026-09-01', status: 'done', exerciseIds: [], entries: [] })
    v1.close()

    const db = new FitnessDB(name)
    expect(await db.workouts.count()).toBe(1)
    await db.bodyWeights.add({
      id: 'b1',
      date: '2026-09-01',
      weightKg: 80,
      updatedAt: 0,
      deletedAt: null,
    })
    expect(await db.bodyWeights.count()).toBe(1)
  })

  it('вес попадает в резервную копию; старая копия без веса восстанавливается', async () => {
    const r = await setup()
    await r.bodyWeights.record(81)
    const backup = await createBackup(r.db, 0)
    expect(backup.bodyWeights).toHaveLength(1)

    const target = await setup()
    await restoreBackup(target.db, parseBackup(JSON.stringify(backup)))
    expect((await target.bodyWeights.list()).map((x) => x.weightKg)).toEqual([81])

    const { bodyWeights: _, ...old } = backup
    void _
    await restoreBackup(target.db, parseBackup(JSON.stringify({ ...old, schemaVersion: 1 })))
    expect(await target.bodyWeights.list()).toEqual([])
  })
})

describe('вес тела: экран', () => {
  it('запись с экрана «Прогресс» даже без тренировок', async () => {
    const r = await setup()
    // экран сравнивает с настоящим «сегодня», поэтому и часы базы — настоящие
    r.clock.set(new Date())
    const router = createMemoryRouter(routes, { initialEntries: ['/progress'] })
    render(
      <DataProvider repos={r}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    const input = await screen.findByRole('textbox', { name: 'Вес тела, кг' })
    expect(input).toHaveValue('70')
    await user.click(input)
    await user.keyboard('{Control>}a{/Control}82,4{Enter}')
    await user.click(screen.getByRole('button', { name: 'Записать' }))
    await waitFor(async () =>
      expect((await r.bodyWeights.list()).map((x) => x.weightKg)).toEqual([82.4]),
    )
    expect(await screen.findByRole('button', { name: 'Обновить' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Последние записи веса' })
    expect(within(list).getByText('82,4 кг')).toBeInTheDocument()
    expect((await r.bodyWeights.list())[0].date).toBe(toISODate(new Date(r.clock())))
  })
})
