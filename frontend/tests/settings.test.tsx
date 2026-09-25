// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { createBackup } from '../src/data/backup'
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

async function withWorkout() {
  const r = await setup()
  const w = await r.workouts.start(null)
  w.entries.push({
    ...(await r.workouts.buildEntry('builtin-squat', null)),
    sets: [{ weightKg: 100, reps: 5, done: true }],
  })
  await r.workouts.save(w)
  await r.workouts.finish(w.id)
  return r
}

describe('настройки', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('открываются кнопкой в верхней панели', async () => {
    const { user, router } = renderAt('/', await setup())
    await user.click(await screen.findByRole('button', { name: 'Настройки' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'))
    expect(await screen.findByText('Резервная копия')).toBeInTheDocument()
  })

  it('«Сегодня» напоминает о копии, а после сохранения — нет', async () => {
    const r = await withWorkout()
    const saved: Blob[] = []
    // в jsdom нет URL.createObjectURL — подставляем свою, чтобы поймать сохранённый файл
    URL.createObjectURL = (b: Blob | MediaSource) => (saved.push(b as Blob), 'blob:x')
    URL.revokeObjectURL = () => {}
    const { user } = renderAt('/', r)

    await user.click(await screen.findByRole('button', { name: /Сохраните резервную копию/ }))
    await user.click(await screen.findByRole('button', { name: 'Сохранить копию в файл' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Копия сохранена: 0 программ, 1 тренировка, 31 упражнение.',
    )
    expect(await r.meta.get('lastExportAt')).not.toBeNull()
    expect(JSON.parse(await saved[0].text()).app).toBe('fitnes')

    await user.click(screen.getByRole('link', { name: 'Сегодня' }))
    await screen.findByRole('heading', { level: 1, name: 'Сегодня' })
    expect(
      screen.queryByRole('button', { name: /Сохраните резервную копию/ }),
    ).not.toBeInTheDocument()
  })

  it('восстановление из файла с подтверждением', async () => {
    const source = await withWorkout()
    await source.programs.create('Из копии')
    const file = new File(
      [JSON.stringify(await createBackup(source.db, Date.now()))],
      'fitnes.json',
      {
        type: 'application/json',
      },
    )

    const target = await setup()
    const { user } = renderAt('/settings', target)
    await user.upload(await screen.findByLabelText('Файл резервной копии'), file)
    const sheet = await screen.findByRole('dialog', { name: 'Восстановить копию?' })
    expect(sheet).toHaveTextContent('1 программа, 1 тренировка, 31 упражнение')
    await user.click(within(sheet).getByRole('button', { name: 'Восстановить' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Восстановлено')
    expect((await target.programs.list()).map((p) => p.name)).toEqual(['Из копии'])
    expect(await target.workouts.listDone()).toHaveLength(1)
  })

  it('чужой файл — понятная ошибка, данные не тронуты', async () => {
    const r = await withWorkout()
    const { user } = renderAt('/settings', r)
    await user.upload(
      await screen.findByLabelText('Файл резервной копии'),
      new File(['{"hello":1}'], 'x.json', { type: 'application/json' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Это не резервная копия приложения')
    expect(await r.workouts.listDone()).toHaveLength(1)
  })

  it('удаление всех данных с подтверждением, справочник загружается заново', async () => {
    const r = await withWorkout()
    await r.exercises.create({ name: 'Своё', muscle: 'arms', type: 'weight' })
    const { user } = renderAt('/settings', r)
    await user.click(await screen.findByRole('button', { name: 'Удалить все данные' }))
    await user.click(screen.getByRole('button', { name: 'Удалить всё' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Все данные удалены')
    expect(await r.workouts.listDone()).toEqual([])
    expect((await r.exercises.list()).length).toBe(31)
  })
})
