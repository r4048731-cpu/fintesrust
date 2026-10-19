// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import {
  needsOnboarding,
  onboardingBuilderInput,
  ONBOARDING_DEFAULTS,
} from '../src/domain/onboarding'
import { setup } from './helpers'

async function firstRun() {
  const r = await setup({ onboarded: false })
  const router = createMemoryRouter(routes, { initialEntries: ['/'] })
  render(
    <DataProvider repos={r}>
      <RouterProvider router={router} />
    </DataProvider>,
  )
  return { r, router, user: userEvent.setup() }
}

describe('знакомство: правила', () => {
  it('показывается только в пустом приложении, которое его ещё не проходило', () => {
    expect(needsOnboarding({ onboarded: false, programs: 0, workouts: 0 })).toBe(true)
    expect(needsOnboarding({ onboarded: true, programs: 0, workouts: 0 })).toBe(false)
    expect(needsOnboarding({ onboarded: false, programs: 1, workouts: 0 })).toBe(false)
    expect(needsOnboarding({ onboarded: false, programs: 0, workouts: 3 })).toBe(false)
  })

  it('ответы превращаются в параметры подбора; без веса — вес по умолчанию', () => {
    const input = onboardingBuilderInput({ ...ONBOARDING_DEFAULTS, place: 'home', weightKg: 82 })
    expect(input).toMatchObject({ place: 'home', dumbbells: true, pullUpBar: true, weightKg: 82 })
    const noWeight = onboardingBuilderInput({ ...ONBOARDING_DEFAULTS, weightKg: null })
    expect(noWeight.weightKg).toBeGreaterThan(0)
  })
})

describe('знакомство на экране', () => {
  it('пустое приложение открывается знакомством; 3 шага создают программу и вес', async () => {
    const { r, router, user } = await firstRun()
    await screen.findByRole('heading', { name: 'Привет! Какая у вас цель?' })
    expect(router.state.location.pathname).toBe('/welcome')

    await user.click(screen.getByRole('button', { name: 'Похудеть' }))
    await user.click(screen.getByRole('button', { name: 'Дома' }))
    await user.click(
      within(screen.getByRole('group', { name: 'Тренировок в неделю' })).getByRole('button', {
        name: '4',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Дальше' }))

    await screen.findByRole('heading', { name: 'Программа' })
    const advised = screen.getByRole('radio', { name: /Подобрать под меня/ })
    expect(advised).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'Дальше' }))

    await screen.findByRole('heading', { name: 'Сколько вы весите?' })
    await user.click(screen.getByRole('button', { name: 'Вес тела, кг: увеличить на 0,5' }))
    await user.click(screen.getByRole('button', { name: 'Готово' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await r.meta.get('onboarded')).toBe(true)
    const active = await r.programs.getActive()
    expect(active).not.toBeNull()
    expect(active!.days.length).toBe(4)
    const weights = await r.bodyWeights.list()
    expect(weights.map((w) => w.measuredKg)).toEqual([75.5])
    expect(await r.meta.get('builderInput')).toMatchObject({ goal: 'lose', place: 'home' })
  })

  it('шаблон и «Без веса»: программа из шаблона, вес не записан', async () => {
    const { r, router, user } = await firstRun()
    await user.click(await screen.findByRole('button', { name: 'Дальше' }))
    await user.click(await screen.findByRole('radio', { name: /Верх \/ Низ/ }))
    await user.click(screen.getByRole('button', { name: 'Дальше' }))
    await user.click(await screen.findByRole('button', { name: 'Без веса' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect((await r.programs.getActive())?.name).toBe('Верх / Низ')
    expect(await r.bodyWeights.list()).toEqual([])
  })

  it('«Пропустить» больше не показывает знакомство', async () => {
    const { r, router, user } = await firstRun()
    await user.click(await screen.findByRole('button', { name: 'Пропустить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await r.meta.get('onboarded')).toBe(true)
    expect(await r.programs.list()).toEqual([])
    await screen.findByRole('navigation', { name: 'Разделы' })
    expect(router.state.location.pathname).toBe('/')
  })
})
