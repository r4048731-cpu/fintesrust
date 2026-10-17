// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { parseBackup } from '../src/data/backup'
import { noteHeading } from '../src/data/repositories/notes'
import { DAY, setup } from './helpers'

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

describe('заметки', () => {
  it('репозиторий: пустую не сохранить, свежие сверху, удалённую можно вернуть', async () => {
    const r = await setup()
    await expect(r.notes.add({ title: ' ', text: '\n' })).rejects.toThrow(/пустая/)
    const a = await r.notes.add({ title: '', text: 'Первая строка\nвторая' })
    r.clock.advance(DAY)
    await r.notes.add({ title: 'Б', text: '' })
    expect((await r.notes.list()).map(noteHeading)).toEqual(['Б', 'Первая строка'])

    r.clock.advance(DAY)
    await r.notes.update(a.id, { title: 'А', text: 'текст' })
    expect((await r.notes.list()).map((n) => n.title)).toEqual(['А', 'Б'])

    await r.notes.remove(a.id)
    expect((await r.notes.list()).map((n) => n.title)).toEqual(['Б'])
    await r.notes.restore(a.id)
    expect(await r.notes.list()).toHaveLength(2)
  })

  it('экран: добавить, найти, изменить, удалить и вернуть', async () => {
    const r = await setup()
    const { user } = renderAt('/notes', r)

    await user.click(await screen.findByRole('button', { name: 'Добавить' }))
    let sheet = screen.getByRole('dialog', { name: 'Новая заметка' })
    await user.click(within(sheet).getByRole('button', { name: 'Добавить заметку' }))
    expect(within(sheet).getByText(/Заметка пустая/)).toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Заголовок'), 'Жим в Смите')
    await user.type(within(sheet).getByLabelText('Текст'), 'Сиденье на 4, спинка на 2')
    await user.click(within(sheet).getByRole('button', { name: 'Добавить заметку' }))

    await user.click(screen.getByRole('button', { name: 'Добавить' }))
    sheet = screen.getByRole('dialog', { name: 'Новая заметка' })
    await user.type(within(sheet).getByLabelText('Текст'), 'Купить магнезию')
    await user.click(within(sheet).getByRole('button', { name: 'Добавить заметку' }))

    const list = await screen.findByRole('list', { name: 'Заметки' })
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2))
    // без заголовка — первая строка текста
    expect(within(list).getByRole('button', { name: /^Купить магнезию/ })).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Поиск по заметкам' }), 'сиденье')
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)

    await user.click(within(list).getByRole('button', { name: /Жим в Смите/ }))
    sheet = screen.getByRole('dialog', { name: 'Заметка' })
    const text = within(sheet).getByLabelText('Текст')
    await user.clear(text)
    await user.type(text, 'Сиденье на 5')
    await user.click(within(sheet).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () =>
      expect((await r.notes.list()).find((n) => n.title === 'Жим в Смите')?.text).toBe(
        'Сиденье на 5',
      ),
    )

    await user.click(within(list).getByRole('button', { name: /Жим в Смите/ }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Заметка' })).getByRole('button', {
        name: 'Удалить заметку',
      }),
    )
    const undo = await screen.findByRole('status')
    expect(undo).toHaveTextContent('Заметка удалена')
    await waitFor(async () => expect(await r.notes.list()).toHaveLength(1))
    await user.click(within(undo).getByRole('button', { name: 'Вернуть' }))
    await waitFor(async () => expect(await r.notes.list()).toHaveLength(2))
  })

  it('из кнопки «+» и меню «Ещё»', async () => {
    const r = await setup()
    const { user, router } = renderAt('/', r)
    await user.click(await screen.findByRole('button', { name: 'Быстро добавить' }))
    await user.click(screen.getByRole('button', { name: /^Заметка/ }))
    const sheet = screen.getByRole('dialog', { name: 'Новая заметка' })
    // из «+» — только новая, удалять нечего
    expect(within(sheet).queryByRole('button', { name: 'Удалить заметку' })).not.toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Текст'), 'Быстрая')
    await user.click(within(sheet).getByRole('button', { name: 'Добавить заметку' }))
    await waitFor(async () => expect(await r.notes.list()).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: 'Ещё' }))
    await user.click(screen.getByRole('button', { name: /^Заметки/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/notes'))
    expect(await screen.findByRole('button', { name: /^Быстрая/ })).toBeInTheDocument()
  })

  it('кнопка «Заметки» на вкладке «Программы»', async () => {
    const { user, router } = renderAt('/programs', await setup())
    await user.click(await screen.findByRole('button', { name: 'Заметки' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/notes'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Заметки' })).toBeInTheDocument()
  })

  it('старая копия без заметок восстанавливается с пустым списком', () => {
    const b = parseBackup(
      JSON.stringify({
        app: 'fitnes',
        version: 1,
        schemaVersion: 3,
        exportedAt: '',
        exercises: [],
        programs: [],
        workouts: [],
        meta: [],
      }),
    )
    expect(b.notes).toEqual([])
  })
})
