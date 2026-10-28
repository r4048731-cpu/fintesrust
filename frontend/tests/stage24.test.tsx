// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { mealSlot, slotByTime } from '../src/domain/mealSlots'
import { toISODate } from '../src/domain/metrics'
import { inPeriod } from '../src/domain/period'
import { trimLeadingZeros } from '../src/domain/steps'
import { formatSleep, waterGoalMl, withDay } from '../src/domain/trackers'
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

const at = (h: number) => new Date(2026, 9, 27, h, 0).getTime()

describe('приёмы пищи, вода и сон, календарь, периоды', () => {
  it('приём пищи: выбранный или по времени добавления', () => {
    expect(slotByTime(at(8))).toBe('breakfast')
    expect(slotByTime(at(13))).toBe('lunch')
    expect(slotByTime(at(16))).toBe('snack')
    expect(slotByTime(at(20))).toBe('dinner')
    expect(mealSlot({ createdAt: at(8) })).toBe('breakfast')
    expect(mealSlot({ slot: 'dinner', createdAt: at(8) })).toBe('dinner')
  })

  it('вода и сон: норма по весу, формат сна, пустой день убирается', () => {
    expect(waterGoalMl(null)).toBe(2000)
    expect(waterGoalMl(80)).toBe(2500)
    expect(formatSleep(450)).toBe('7 ч 30 мин')
    expect(formatSleep(480)).toBe('8 ч')
    expect(formatSleep(40)).toBe('40 мин')
    const one = withDay({}, '2026-10-27', { waterMl: 250 })
    expect(one).toEqual({ '2026-10-27': { waterMl: 250 } })
    expect(withDay(one, '2026-10-27', { waterMl: -100 })).toEqual({})
    expect(withDay({}, '2026-10-27', { sleepMin: 99999 })['2026-10-27'].sleepMin).toBe(1440)
  })

  it('шаги за «всё время» начинаются с первого дня с шагами', () => {
    const days = [0, 0, 1200, 0, 8000].map((steps, i) => ({ date: `2026-10-0${i + 1}`, steps }))
    expect(trimLeadingZeros(days).map((d) => d.steps)).toEqual([1200, 0, 8000])
    expect(trimLeadingZeros([{ date: '2026-10-01', steps: 0 }])).toEqual([])
  })

  it('период графика: неделя — последние 7 дней включая сегодня', () => {
    const rows = ['2026-10-01', '2026-10-21', '2026-10-27'].map((date) => ({ date }))
    expect(inPeriod(rows, 'week', '2026-10-27').map((r) => r.date)).toEqual([
      '2026-10-21',
      '2026-10-27',
    ])
    expect(inPeriod(rows, 'all', '2026-10-27')).toHaveLength(3)
  })

  it('«+» на плитке «Завтрак» добавляет еду в завтрак', async () => {
    const r = await setup()
    r.clock.set(new Date())
    const { user } = renderAt('/food', r)
    await user.click(await screen.findByRole('button', { name: /^Завтрак: 0 ккал/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Завтрак: добавить' })
    expect(within(sheet).getByRole('button', { name: 'Завтрак' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.type(within(sheet).getByRole('textbox', { name: 'Название' }), 'Омлет')
    await user.type(within(sheet).getByRole('textbox', { name: 'Ккал' }), '300')
    await user.click(within(sheet).getByRole('button', { name: 'Добавить' }))
    await waitFor(async () =>
      expect((await r.meals.listDay(toISODate(new Date())))[0]).toMatchObject({
        name: 'Омлет',
        slot: 'breakfast',
      }),
    )
    expect(await screen.findByRole('button', { name: /^Завтрак: 300 ккал/ })).toBeInTheDocument()
  })

  it('вода по стакану и сон за день хранятся в meta', async () => {
    const r = await setup()
    const { user } = renderAt('/food', r)
    const today = toISODate(new Date())
    await user.click(await screen.findByRole('button', { name: 'Вода: плюс 250 мл' }))
    await user.click(screen.getByRole('button', { name: 'Вода: плюс 250 мл' }))
    await waitFor(async () =>
      expect((await r.meta.get('dayTrackers'))[today]).toEqual({ waterMl: 500 }),
    )
    await user.click(screen.getByRole('button', { name: /^Сон: не записан/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Сколько спали' })
    await user.click(within(sheet).getByRole('button', { name: /Сон, часов: уменьшить/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () =>
      expect((await r.meta.get('dayTrackers'))[today]).toEqual({ waterMl: 500, sleepMin: 450 }),
    )
    expect(await screen.findByRole('button', { name: /^Сон: 7 ч 30 мин/ })).toBeInTheDocument()
  })

  it('календарь в «Истории»: день с тренировкой отмечен и открывает её', async () => {
    const r = await setup()
    r.clock.set(new Date())
    const w = await r.workouts.start(null)
    const entry = await r.workouts.buildEntry('builtin-squat', null)
    w.entries.push({ ...entry, sets: [{ weightKg: 60, reps: 5, done: true }] })
    await r.workouts.save(w)
    await r.workouts.finish(w.id)
    const { user, router } = renderAt('/progress?view=history', r)
    const calendar = await screen.findByRole('region', { name: 'Календарь тренировок' })
    const today = new Date()
    expect(
      within(calendar).getByRole('button', {
        name: new RegExp(`^${today.getDate()} .*, тренировка`),
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(calendar).getByRole('button', { name: new RegExp(w.name) }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/history/${w.id}`))
  })

  it('истории на «Сегодня»: три кружка, листание слайдов, переход к инструкции', async () => {
    const r = await setup()
    const { user, router } = renderAt('/', r)
    const row = await screen.findByRole('group', { name: 'Истории' })
    // свёрнуты: кружки выглядывают, нажатие раскрывает шапку
    expect(within(row).queryByRole('button', { name: 'История «Скоро»' })).not.toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'Показать истории' }))
    expect(
      within(row)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['История «Тренировка»', 'История «Скоро»', 'История «Инструкция»'])

    await user.click(within(row).getByRole('button', { name: 'История «Скоро»' }))
    const viewer = screen.getByRole('dialog', { name: 'Скоро' })
    expect(within(viewer).getByRole('heading', { name: 'ИИ-тренер' })).toBeInTheDocument()
    await user.click(within(viewer).getByRole('button', { name: 'Дальше' }))
    expect(
      within(viewer).getByRole('heading', { name: 'Боты в Telegram и MAX' }),
    ).toBeInTheDocument()
    await user.click(within(viewer).getByRole('button', { name: 'Назад' }))
    expect(within(viewer).getByRole('heading', { name: 'ИИ-тренер' })).toBeInTheDocument()
    // просмотренная история помечается
    expect(within(row).getByRole('button', { name: 'История «Скоро»' })).toHaveAttribute(
      'data-seen',
    )

    // с последнего слайда «Скоро» — дальше в «Инструкцию», её кнопка ведёт в справку
    await user.click(within(viewer).getByRole('button', { name: 'Дальше' }))
    await user.click(within(viewer).getByRole('button', { name: 'Дальше' }))
    await user.click(within(viewer).getByRole('button', { name: 'Дальше' }))
    const guide = screen.getByRole('dialog', { name: 'Инструкция' })
    for (let i = 0; i < 3; i++)
      await user.click(within(guide).getByRole('button', { name: 'Дальше' }))
    await user.click(within(guide).getByRole('button', { name: 'Вся инструкция' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/help'))
    expect(screen.queryByRole('dialog', { name: 'Инструкция' })).not.toBeInTheDocument()
  })

  it('раскрытая шапка историй сворачивается, когда страницу прокрутили', async () => {
    const r = await setup()
    const { user } = renderAt('/', r)
    const row = await screen.findByRole('group', { name: 'Истории' })
    await user.click(within(row).getByRole('button', { name: 'Показать истории' }))
    expect(within(row).getByRole('button', { name: 'История «Тренировка»' })).toBeInTheDocument()
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    expect(await within(row).findByRole('button', { name: 'Показать истории' })).toBeInTheDocument()
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })
})
