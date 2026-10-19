// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { workingWeight } from '../src/domain/metrics'
import { toISODate } from '../src/domain/metrics'
import { PROGRAM_TEMPLATES } from '../src/domain/templates'
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

const day = (offset: number) => {
  const n = new Date()
  return toISODate(new Date(n.getFullYear(), n.getMonth(), n.getDate() + offset))
}

/** База с часами «сейчас» и программой «Верх/Низ» из шаблона. */
async function withProgram() {
  const r = await setup()
  r.clock.set(new Date())
  const p = await r.programs.create('Верх / Низ', 'upperlower')
  return { r, p }
}

describe('рабочий вес', () => {
  it('вес большинства подходов, при равенстве — больший', () => {
    const s = (weightKg: number) => ({ weightKg, reps: 8, done: true })
    expect(workingWeight([s(40), s(60), s(60), s(60)])).toBe(60)
    expect(workingWeight([s(60), s(60), s(70), s(70)])).toBe(70)
    expect(workingWeight([s(50)])).toBe(50)
  })
})

describe('бокс', () => {
  it('программа «Бокс»: раунды по времени и удары с гантелями', async () => {
    const t = PROGRAM_TEMPLATES.find((x) => x.kind === 'boxing')!
    expect(t.days.map((d) => d.name)).toEqual(['Техника и удары', 'Сила для бокса', 'Выносливость'])
    const r = await setup()
    const boxing = await r.exercises.list({ muscle: 'boxing' })
    expect(boxing.map((e) => e.name)).toContain('Бой с тенью с гантелями')
    const bag = boxing.find((e) => e.name === 'Работа на мешке')!
    expect(bag.type).toBe('time')
    expect(t.days[0].items.find((i) => i.exerciseId === bag.id)).toMatchObject({
      sets: 4,
      repsMin: 180,
    })
  })
})

describe('«История» → «Добавить тренировку»', () => {
  it('за прошедший день: подходы из плана уже отмечены, после «Готово» — в истории', async () => {
    const { r } = await withProgram()
    const { user, router } = renderAt('/history', r)
    await user.click(await screen.findByRole('button', { name: 'Добавить' }))
    const sheet = screen.getByRole('dialog', { name: 'Добавить тренировку' })
    fireEvent.change(within(sheet).getByLabelText('Дата'), { target: { value: day(-2) } })
    // дни программ подгружаются из базы чуть позже шторки
    const option = await within(sheet).findByRole('option', { name: 'Верх / Низ · Верх' })
    await user.selectOptions(within(sheet).getByLabelText('Упражнения'), option)
    expect(within(sheet).getByText(/сразу попадёт в историю/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Добавить' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/history\/.+\/edit$/))
    expect(await screen.findByText('Своя тренировка')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /^Жим штанги лёжа —/ }))
    const bench = await screen.findByRole('dialog', { name: 'Жим штанги лёжа' })
    expect(within(bench).getAllByRole('button', { name: /выполнен/ })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(bench).getByRole('button', { name: 'Закрыть' }))
    await user.click(screen.getByRole('button', { name: 'Готово' }))

    const done = await r.workouts.listDone()
    expect(done).toHaveLength(1)
    expect(done[0]).toMatchObject({ date: day(-2), name: 'Верх', manual: true, status: 'done' })
    // длительности у внесённой вручную нет
    expect(await screen.findByText('—')).toBeInTheDocument()
  })

  it('пустая внесённая тренировка без подходов не остаётся в истории', async () => {
    const { r } = await withProgram()
    const { user, router } = renderAt('/history', r)
    await user.click(await screen.findByRole('button', { name: 'Добавить' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Добавить' }))
    await screen.findByText('Своя тренировка')
    await user.click(screen.getByRole('button', { name: 'Назад' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/progress'))
    expect(await r.workouts.listDone()).toEqual([])
  })

  it('на будущую дату — запланирована, в свой день появляется на «Сегодня» и начинается', async () => {
    const { r, p } = await withProgram()
    // завтра: создаётся план
    const planned = await r.workouts.createManual({
      date: day(1),
      from: { programId: p.id, dayId: p.days[1].id },
      today: day(0),
    })
    expect(planned.status).toBe('planned')
    expect(await r.workouts.plannedFor(day(0))).toBeNull()
    // «наступило завтра»: переносим план на сегодня, как будто день пришёл
    await r.workouts.save({ ...planned, date: day(0) })

    const { user, router } = renderAt('/', r)
    const card = await screen.findByRole('region', { name: 'Запланировано на сегодня' })
    expect(within(card).getByRole('heading', { name: 'Низ' })).toBeInTheDocument()
    // кнопка «Начать» закреплена внизу экрана, вне карточки
    await user.click(screen.getByRole('button', { name: /^Начать:/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    const active = await r.workouts.getActive()
    expect(active).toMatchObject({ id: planned.id, status: 'active', date: day(0) })
    expect(await r.workouts.listPlanned()).toEqual([])
    // программа от плана не сдвигается до завершения
    expect((await r.programs.nextDay(p.id))?.day.name).toBe('Верх')
  })

  it('запланированные видны в «Истории» отдельным блоком и удаляются', async () => {
    const { r } = await withProgram()
    await r.workouts.createManual({ date: day(3), from: null, today: day(0) })
    const { user } = renderAt('/history', r)
    const block = await screen.findByRole('region', { name: 'Запланировано' })
    await user.click(within(block).getByRole('button', { name: /Запланированная тренировка/ }))
    expect(await screen.findByText('Запланированная')).toBeInTheDocument()
    // у плана нечего отмечать
    expect(screen.queryByRole('button', { name: /выполнен/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Удалить из плана' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Удалить' }),
    )
    await waitFor(async () => expect(await r.workouts.listPlanned()).toEqual([]))
  })
})

describe('экран «Сегодня»', () => {
  it('план списком, кнопка «Начать» внизу, быстрые действия, без записи веса', async () => {
    const { r } = await withProgram()
    const { user, router } = renderAt('/', r)
    const plan = await screen.findByRole('region', { name: 'Верх / Низ' })
    expect(within(plan).getByRole('heading', { name: 'Верх' })).toBeInTheDocument()
    // длинный план свёрнут: 4 упражнения и «ещё»
    expect(within(plan).getAllByRole('listitem')).toHaveLength(4)
    await user.click(within(plan).getByRole('button', { name: 'Ещё 2 упражнения' }))
    expect(within(plan).getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByRole('button', { name: /^Начать:/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Свободная тренировка без плана' }),
    ).toBeInTheDocument()
    // выбора вида больше нет
    expect(screen.queryByRole('group', { name: /Вид экрана/ })).not.toBeInTheDocument()

    // вес записывается в «Прогресс → Вес тела», на «Сегодня» его больше нет
    expect(screen.queryByRole('region', { name: 'Вес сегодня' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Питание' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/food'))
  })
})
