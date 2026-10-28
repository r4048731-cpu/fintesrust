// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { Sheet } from '../src/components/Sheet'
import { Stepper } from '../src/components/Stepper'
import { setup } from './helpers'

async function renderApp(path = '/', existing?: Awaited<ReturnType<typeof setup>>) {
  const repos = existing ?? (await setup())
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <DataProvider repos={repos}>
      <RouterProvider router={router} />
    </DataProvider>,
  )
  return { repos, router }
}

describe('навигация', () => {
  it('нижняя панель переключает вкладки и отмечает текущую', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp()
    const nav = await screen.findByRole('navigation', { name: 'Разделы' })
    expect(within(nav).getByRole('link', { name: 'Сегодня' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // «История» — раздел вкладки «Прогресс», открывается по умолчанию
    await user.click(within(nav).getByRole('link', { name: 'Прогресс' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Прогресс' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/progress')
    expect(screen.getByRole('button', { name: 'История' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(nav).getByRole('link', { name: 'Прогресс' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // старый адрес истории ведёт туда же
    await router.navigate('/history')
    await waitFor(() => expect(router.state.location.pathname).toBe('/progress'))
    expect(router.state.location.search).toBe('?view=history')

    // по центру панели — «+», первым пунктом в нём ИИ-помощник
    const links = within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent)
    expect(links).toEqual(['Сегодня', 'Программы', 'Прогресс', 'Питание'])
    await user.click(within(nav).getByRole('button', { name: 'Быстро добавить' }))
    await user.click(await screen.findByRole('button', { name: /^Спросить ИИ/ }))
    // пока заглушка «скоро»
    expect(screen.getByRole('dialog', { name: 'ИИ-помощник' })).toHaveTextContent('Скоро')
  })

  it('неизвестный адрес ведёт на «Сегодня»', async () => {
    const { router } = await renderApp('/nope')
    expect(await screen.findByRole('heading', { level: 1, name: 'Сегодня' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('пустой экран «Сегодня» ведёт к программам', async () => {
    const user = userEvent.setup()
    await renderApp()
    await user.click(await screen.findByRole('button', { name: 'Перейти к программам' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Программы' })).toBeInTheDocument()
  })

  it('шаг веса сохраняется в настройках', async () => {
    const user = userEvent.setup()
    const { repos } = await renderApp('/settings')
    await user.click(await screen.findByRole('button', { name: /Шаг веса, кг: увеличить/ }))
    await expect.poll(() => repos.meta.get('weightStepKg')).toBe(2.75)
  })
})

function StepperHarness({ initial = 60 }: { initial?: number }) {
  const [v, setV] = useState(initial)
  return (
    <>
      <Stepper label="Вес, кг" value={v} onChange={setV} step={2.5} decimal />
      <output>{v}</output>
    </>
  )
}

describe('Stepper', () => {
  it('кнопки ± меняют значение на шаг', async () => {
    const user = userEvent.setup()
    render(<StepperHarness />)
    await user.click(screen.getByRole('button', { name: 'Вес, кг: увеличить на 2,5' }))
    expect(screen.getByRole('textbox', { name: 'Вес, кг' })).toHaveValue('62,5')
    await user.click(screen.getByRole('button', { name: 'Вес, кг: уменьшить на 2,5' }))
    await user.click(screen.getByRole('button', { name: 'Вес, кг: уменьшить на 2,5' }))
    expect(screen.getByRole('status')).toHaveTextContent('57.5')
  })

  it('принимает ввод с запятой, мусор отбрасывает', async () => {
    const user = userEvent.setup()
    render(<StepperHarness />)
    const input = screen.getByRole('textbox', { name: 'Вес, кг' })
    await user.click(input)
    await user.keyboard('{Control>}a{/Control}72,5{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('72.5')
    await user.click(input)
    await user.keyboard('{Control>}a{/Control}abc{Enter}')
    expect(input).toHaveValue('72,5')
  })

  it('не опускается ниже минимума', async () => {
    const user = userEvent.setup()
    render(<StepperHarness initial={0} />)
    expect(screen.getByRole('button', { name: /уменьшить/ })).toBeDisabled()
    await user.click(screen.getByRole('textbox', { name: 'Вес, кг' }))
    await user.keyboard('{Control>}a{/Control}-5{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('0')
  })
})

describe('Sheet', () => {
  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Открыть</button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Упражнения">
          <p>Содержимое</p>
        </Sheet>
      </>
    )
  }

  it('открывается и закрывается кнопкой', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.queryByText('Содержимое')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Открыть' }))
    expect(screen.getByRole('dialog', { name: 'Упражнения' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByText('Содержимое')).not.toBeInTheDocument()
  })
})

describe('переключатель темы', () => {
  it('переключает белую и чёрную тему и запоминает выбор', async () => {
    const user = userEvent.setup()
    localStorage.removeItem('fitnes.theme')
    document.documentElement.dataset.theme = 'light'
    await renderApp()
    await user.click(await screen.findByRole('button', { name: 'Включить тёмную тему' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('fitnes.theme')).toBe('dark')
    await user.click(screen.getByRole('button', { name: 'Включить светлую тему' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('fitnes.theme')).toBe('light')
  })
})
