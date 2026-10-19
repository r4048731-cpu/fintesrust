// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { setup } from './helpers'

async function openPrograms() {
  const r = await setup()
  await r.meta.set('bodyProfile', {
    sex: 'female',
    age: 34,
    heightCm: 168,
    activity: 'moderate',
    goal: 'lose',
  })
  await r.bodyWeights.record(64)
  const router = createMemoryRouter(routes, { initialEntries: ['/programs'] })
  render(
    <DataProvider repos={r}>
      <RouterProvider router={router} />
    </DataProvider>,
  )
  return { r, router, user: userEvent.setup() }
}

describe('«Подобрать программу»', () => {
  it('подставляет профиль, собирает программу дома и сохраняет её в редактор', async () => {
    const { r, router, user } = await openPrograms()
    await user.click(await screen.findByRole('button', { name: 'Подобрать под меня' }))
    const sheet = await screen.findByRole('dialog', { name: 'Подобрать программу' })

    // из расчёта питания и последнего веса
    const pressed = (group: string) =>
      within(within(sheet).getByRole('group', { name: group })).getByRole('button', {
        pressed: true,
      })
    expect(pressed('Пол')).toHaveTextContent('Женский')
    expect(pressed('Цель')).toHaveTextContent('Похудеть')
    expect(within(sheet).getByRole('textbox', { name: 'Возраст, лет' })).toHaveValue('34')
    expect(within(sheet).getByRole('textbox', { name: 'Вес, кг' })).toHaveValue('64')

    await user.click(within(sheet).getByRole('button', { name: 'Дома' }))
    await user.click(within(sheet).getByRole('button', { name: 'Турник' }))
    expect(within(sheet).getByText(/Для 3 тренировок в неделю — фулбади/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Составить программу' }))

    const preview = await screen.findByRole('dialog', { name: 'Фулбади — под меня' })
    expect(within(preview).getByRole('list', { name: 'Почему так' })).toHaveTextContent(
      'Дома: упражнения с собственным весом, плюс гантели и турник',
    )
    const dayA = within(preview).getByRole('region', { name: 'Фулбади A' })
    expect(dayA).toHaveTextContent('Австралийские подтягивания')
    expect(dayA).toHaveTextContent('Скакалка')
    const before = dayA.textContent
    await user.click(within(preview).getByRole('button', { name: 'Другой вариант упражнений' }))
    expect(within(preview).getByRole('region', { name: 'Фулбади A' }).textContent).not.toBe(before)

    await user.click(within(preview).getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/programs\/.+/))
    const [program] = await r.programs.list()
    expect(program).toMatchObject({ name: 'Фулбади — под меня', kind: 'fullbody' })
    expect(program.days).toHaveLength(3)
    // первая программа становится активной; ответы запоминаются
    expect((await r.programs.getActive())?.id).toBe(program.id)
    expect(await r.meta.get('builderInput')).toMatchObject({
      sex: 'female',
      place: 'home',
      pullUpBar: true,
    })
  })

  it('«Параметры» возвращает к форме с прежними ответами', async () => {
    const { user } = await openPrograms()
    await user.click(await screen.findByRole('button', { name: 'Подобрать под меня' }))
    const sheet = await screen.findByRole('dialog', { name: 'Подобрать программу' })
    await user.click(within(sheet).getByRole('button', { name: '5' }))
    await user.click(within(sheet).getByRole('button', { name: 'Больше 2 лет' }))
    await user.click(within(sheet).getByRole('button', { name: 'Составить программу' }))
    const preview = await screen.findByRole('dialog', { name: 'Сплит — под меня' })
    expect(within(preview).getByRole('region', { name: 'Руки' })).toBeInTheDocument()
    await user.click(within(preview).getByRole('button', { name: 'Параметры' }))
    const back = await screen.findByRole('dialog', { name: 'Подобрать программу' })
    expect(
      within(within(back).getByRole('group', { name: 'Тренировок в неделю' })).getByRole('button', {
        pressed: true,
      }),
    ).toHaveTextContent('5')
  })
})
