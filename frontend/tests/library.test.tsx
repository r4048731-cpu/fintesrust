// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { ExercisePicker } from '../src/components/ExercisePicker'
import type { Exercise } from '../src/domain/types'
import { setup } from './helpers'

async function openLibrary() {
  const repos = await setup()
  const router = createMemoryRouter(routes, { initialEntries: ['/programs/exercises'] })
  render(
    <DataProvider repos={repos}>
      <RouterProvider router={router} />
    </DataProvider>,
  )
  // список появляется после загрузки из базы
  await screen.findByRole('searchbox', { name: 'Поиск по названию' })
  return { repos, router, user: userEvent.setup() }
}

describe('справочник упражнений', () => {
  it('открывается с экрана программ и возвращается назад', async () => {
    const repos = await setup()
    const router = createMemoryRouter(routes, { initialEntries: ['/programs'] })
    render(
      <DataProvider repos={repos}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Упражнения' }))
    expect(await screen.findByText('В справочнике: 31')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Назад' }))
    expect(router.state.location.pathname).toBe('/programs')
  })

  it('без фильтров показывает группы мышц, поиск находит без учёта ё', async () => {
    const { user } = await openLibrary()
    expect(screen.getByRole('region', { name: 'Грудь' })).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Поиск по названию' }), 'лежа')
    const found = screen.getByRole('list', { name: 'Найденные упражнения' })
    expect(
      within(found)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([
      expect.stringContaining('Жим гантелей лёжа'),
      expect.stringContaining('Жим штанги лёжа'),
    ])
  })

  it('фильтр по группе мышц', async () => {
    const { user } = await openLibrary()
    await user.click(screen.getByRole('button', { name: 'Кардио' }))
    const found = screen.getByRole('list', { name: 'Найденные упражнения' })
    expect(within(found).getAllByRole('button')).toHaveLength(1)
    expect(found).toHaveTextContent('Велотренажёр')
  })

  it('создаёт своё упражнение из пустого поиска', async () => {
    const { user, repos } = await openLibrary()
    await user.type(screen.getByRole('searchbox'), 'Жим в Смите')
    await user.click(screen.getByRole('button', { name: 'Создать «Жим в Смите»' }))
    const dialog = screen.getByRole('dialog', { name: 'Новое упражнение' })
    expect(within(dialog).getByLabelText('Название')).toHaveValue('Жим в Смите')
    await user.selectOptions(within(dialog).getByLabelText('Тип'), 'weight')
    await user.type(within(dialog).getByLabelText('Заметка'), 'Скамья 30°')
    await user.click(within(dialog).getByRole('button', { name: 'Добавить в справочник' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const found = await screen.findByRole('list', { name: 'Найденные упражнения' })
    await waitFor(() => expect(found).toHaveTextContent('Жим в Смитесвоё'))
    expect(found).toHaveTextContent('Скамья 30°')
    const saved = (await repos.exercises.list({ query: 'смите' }))[0]
    expect(saved).toMatchObject({ name: 'Жим в Смите', muscle: 'chest', builtin: false })
  })

  it('показывает ошибку при дубликате и не закрывает форму', async () => {
    const { user } = await openLibrary()
    await user.click(screen.getByRole('button', { name: 'Своё' }))
    const dialog = screen.getByRole('dialog', { name: 'Новое упражнение' })
    await user.click(within(dialog).getByRole('button', { name: 'Добавить в справочник' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Введите название упражнения')
    await user.type(within(dialog).getByLabelText('Название'), 'подтягивания')
    await user.click(within(dialog).getByRole('button', { name: 'Добавить в справочник' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('уже есть в справочнике')
  })

  it('правит и удаляет упражнение с подтверждением', async () => {
    const { user, repos } = await openLibrary()
    await user.type(screen.getByRole('searchbox'), 'планка')
    await user.click(screen.getByRole('button', { name: /Планка/ }))
    let dialog = screen.getByRole('dialog', { name: 'Упражнение' })
    const name = within(dialog).getByLabelText('Название')
    await user.clear(name)
    await user.type(name, 'Планка на локтях')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    expect((await repos.exercises.get('builtin-plank'))?.name).toBe('Планка на локтях')

    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'планка')
    await user.click(await screen.findByRole('button', { name: /Планка на локтях/ }))
    dialog = screen.getByRole('dialog', { name: 'Упражнение' })
    await user.click(within(dialog).getByRole('button', { name: 'Удалить упражнение' }))
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))
    expect(await screen.findByText('Ничего не найдено.')).toBeInTheDocument()
    expect((await repos.exercises.get('builtin-plank'))?.deletedAt).not.toBeNull()
  })
})

describe('выбор упражнения', () => {
  function Harness({ onPick }: { onPick: (e: Exercise) => void }) {
    const [open, setOpen] = useState(true)
    return (
      <ExercisePicker
        open={open}
        onClose={() => setOpen(false)}
        onPick={(e) => {
          onPick(e)
          setOpen(false)
        }}
      />
    )
  }

  it('возвращает выбранное упражнение', async () => {
    const repos = await setup()
    const picked: Exercise[] = []
    render(
      <DataProvider repos={repos}>
        <Harness onPick={(e) => picked.push(e)} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    await user.type(await screen.findByRole('searchbox'), 'становая')
    await user.click(screen.getByRole('button', { name: /Становая тяга/ }))
    expect(picked.map((e) => e.id)).toEqual(['builtin-deadlift'])
  })

  it('новое упражнение из выбора сразу выбирается', async () => {
    const repos = await setup()
    const picked: Exercise[] = []
    render(
      <DataProvider repos={repos}>
        <Harness onPick={(e) => picked.push(e)} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    await user.type(await screen.findByRole('searchbox'), 'Тяга Т-грифа')
    await user.click(screen.getByRole('button', { name: 'Создать «Тяга Т-грифа»' }))
    const form = screen.getByRole('dialog', { name: 'Новое упражнение' })
    await user.selectOptions(within(form).getByLabelText('Группа мышц'), 'back')
    await user.click(within(form).getByRole('button', { name: 'Добавить в справочник' }))
    await expect
      .poll(() => picked.map((e) => [e.name, e.muscle]))
      .toEqual([['Тяга Т-грифа', 'back']])
  })
})
