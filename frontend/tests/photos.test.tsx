// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { createBackup, parseBackup, restoreBackup } from '../src/data/backup'
import { weightNear } from '../src/data/repositories/bodyWeights'
import { toISODate } from '../src/domain/metrics'
import { DAY, setup } from './helpers'

// в jsdom нет canvas: уменьшение снимка подменяется готовыми картинками
vi.mock('../src/components/photoResize', () => ({
  resizePhoto: async () => ({
    image: 'data:image/jpeg;base64,BIG',
    thumb: 'data:image/jpeg;base64,SM',
  }),
}))

const img = { image: 'data:image/jpeg;base64,AAA', thumb: 'data:image/jpeg;base64,BBB' }

describe('фото прогресса: хранение', () => {
  it('по датам от старых к новым; смена даты; удаление стирает картинку', async () => {
    const r = await setup()
    const late = await r.photos.add({ ...img, date: '2026-09-20' })
    r.clock.advance(1000)
    const early = await r.photos.add({ ...img, date: '2026-08-01' })
    r.clock.advance(1000)
    const today = await r.photos.add(img)
    expect(today.date).toBe(toISODate(new Date(r.clock())))
    expect((await r.photos.list()).map((p) => p.id)).toEqual([early.id, late.id, today.id])

    await r.photos.setDate(early.id, '2026-09-21')
    expect((await r.photos.list()).map((p) => p.id)).toEqual([late.id, early.id, today.id])

    await r.photos.remove(late.id)
    expect(await r.photos.list()).toHaveLength(2)
    expect(await r.db.photos.get(late.id)).toMatchObject({ image: '', thumb: '' })
  })

  it('вес на дату снимка — ближайший не дальше недели', () => {
    const row = (date: string, weightKg: number) => ({
      id: date,
      date,
      weightKg,
      updatedAt: 0,
      deletedAt: null,
    })
    const rows = [row('2026-09-01', 82), row('2026-09-10', 80), row('2026-09-14', 79.5)]
    expect(weightNear(rows, '2026-09-10')?.weightKg).toBe(80)
    expect(weightNear(rows, '2026-09-12')?.weightKg).toBe(80)
    expect(weightNear(rows, '2026-09-05')?.weightKg).toBe(82)
    expect(weightNear(rows, '2026-08-20')).toBeNull()
    expect(weightNear(rows, '2026-09-20')?.weightKg).toBe(79.5)
    expect(weightNear(rows, '2026-09-22')).toBeNull()
    expect(weightNear([], '2026-09-22')).toBeNull()
  })

  it('фото попадают в резервную копию; старая копия без фото восстанавливается', async () => {
    const r = await setup()
    await r.photos.add({ ...img, date: '2026-09-01' })
    const backup = await createBackup(r.db, 0)
    expect(backup.photos).toHaveLength(1)

    const target = await setup()
    await restoreBackup(target.db, parseBackup(JSON.stringify(backup)))
    expect(await target.photos.list()).toMatchObject([{ date: '2026-09-01', ...img }])

    const { photos: _, ...old } = backup
    void _
    await restoreBackup(target.db, parseBackup(JSON.stringify({ ...old, schemaVersion: 6 })))
    expect(await target.photos.list()).toEqual([])
  })
})

describe('раздел «Вес»: фото прогресса', () => {
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

  it('добавляет снимок с выбранной датой', async () => {
    const { r, user } = await openWeight()
    expect(await screen.findByText(/раз в 2–4 недели/)).toBeInTheDocument()
    const file = new File(['x'], 'me.jpg', { type: 'image/jpeg', lastModified: Date.now() })
    await user.upload(screen.getByLabelText('Фото прогресса'), file)
    const dialog = await screen.findByRole('dialog', { name: 'Новое фото' })
    expect(within(dialog).getByLabelText('Дата снимка')).toHaveValue(toISODate(new Date()))
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () =>
      expect(await r.photos.list()).toMatchObject([
        { image: 'data:image/jpeg;base64,BIG', thumb: 'data:image/jpeg;base64,SM' },
      ]),
    )
    expect(await screen.findByRole('list', { name: 'Снимки по датам' })).toBeInTheDocument()
  })

  it('сравнивает первый и последний снимок с весом и удаляет снимок', async () => {
    const { r, user } = await openWeight(async (r) => {
      r.clock.set(new Date(2026, 7, 1, 9))
      await r.bodyWeights.record(84)
      await r.photos.add(img)
      r.clock.advance(30 * DAY)
      await r.photos.add(img)
      r.clock.advance(30 * DAY)
      await r.bodyWeights.record(81.5)
      await r.photos.add(img)
      r.clock.set(new Date())
    })
    const compare = await screen.findByRole('region', { name: 'Было и стало' })
    expect(
      within(compare).getByRole('button', { name: 'Было: фото за 1 авг, 84 кг' }),
    ).toBeVisible()
    expect(
      within(compare).getByRole('button', { name: 'Стало: фото за 30 сен, 81,5 кг' }),
    ).toBeVisible()
    expect(compare).toHaveTextContent('60 дней между снимками · −2,5 кг')

    // средний снимок — в «было»
    await user.click(screen.getByRole('button', { name: 'Фото за 31 авг — открыть' }))
    const viewer = await screen.findByRole('dialog', { name: 'Фото за 31 авг' })
    expect(viewer).toHaveTextContent('Вес около этой даты не записан')
    await user.click(within(viewer).getByRole('button', { name: 'Сравнить: «было»' }))
    expect(
      await within(compare).findByRole('button', { name: 'Было: фото за 31 авг' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Фото за 30 сен — открыть' }))
    const last = await screen.findByRole('dialog', { name: 'Фото за 30 сен' })
    await user.click(within(last).getByRole('button', { name: 'Удалить фото' }))
    await user.click(within(last).getByRole('button', { name: 'Удалить навсегда' }))
    await waitFor(async () => expect(await r.photos.list()).toHaveLength(2))
  })
})
