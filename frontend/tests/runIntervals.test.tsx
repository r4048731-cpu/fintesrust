// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import {
  describeIntervals,
  intervalsGoal,
  phaseCue,
  RUN_INTERVAL_PRESETS,
  runIntervalsSec,
  runPhaseAt,
  runPhases,
  upcomingCues,
} from '../src/domain/runIntervals'
import { setup } from './helpers'

const MIN = 60_000
const c = { warmupSec: 300, runSec: 60, walkSec: 90, rounds: 3 }

describe('интервалы в беге: расчёты', () => {
  it('разминка, бег и шаг по очереди; после последнего бега шага нет', () => {
    expect(runPhases(c).map((p) => `${p.kind}${p.round}`)).toEqual([
      'warmup0',
      'run1',
      'walk1',
      'run2',
      'walk2',
      'run3',
    ])
    expect(runIntervalsSec(c)).toBe(300 + 3 * 60 + 2 * 90)
    expect(intervalsGoal(c)).toEqual({ type: 'time', sec: 660 })
    expect(describeIntervals(c)).toBe('Бег 1 мин / шаг 1,5 мин × 3')
    expect(runPhases({ ...c, warmupSec: 0 })[0].kind).toBe('run')
  })

  it('фаза по времени в движении: сколько осталось и что дальше', () => {
    const phases = runPhases(c)
    expect(runPhaseAt(phases, 0)).toMatchObject({ index: 0, remainingMs: 5 * MIN })
    const pos = runPhaseAt(phases, 5.5 * MIN)
    expect(pos.phase).toMatchObject({ kind: 'run', round: 1 })
    expect(pos.remainingMs).toBe(0.5 * MIN)
    expect(pos.next?.kind).toBe('walk')
    expect(runPhaseAt(phases, 11 * MIN).done).toBe(true)
  })

  it('фразы и сигналы для телефона: первая — сразу на старте, потом каждая смена и конец', () => {
    expect(phaseCue(runPhases(c)[1], 3)).toBe('Бегом! Повтор 1 из 3, минуту')
    expect(phaseCue(runPhases(c)[2], 3)).toBe('Шагом, полторы минуты')
    expect(phaseCue(runPhases(c)[5], 3)).toBe('Бегом! Последний повтор, минуту')

    const start = upcomingCues(c, 500)
    expect(start.map((q) => q.kind)).toEqual([
      'warmup',
      'run',
      'walk',
      'run',
      'walk',
      'run',
      'finish',
    ])
    expect(start[0].atMs).toBe(500)
    expect(start[1].atMs).toBe(5 * MIN)
    expect(start.at(-1)!.text).toMatch(/^Интервалы выполнены/)

    // после паузы посреди бега — только будущие смены
    const later = upcomingCues(c, 5.5 * MIN)
    expect(later[0]).toMatchObject({ kind: 'walk', atMs: 6 * MIN })
  })

  it('готовые варианты укладываются в 20–35 минут', () => {
    for (const p of RUN_INTERVAL_PRESETS) {
      const min = runIntervalsSec(p.intervals) / 60
      expect(min).toBeGreaterThanOrEqual(20)
      expect(min).toBeLessThanOrEqual(35)
    }
  })
})

describe('интервалы в беге: экран', () => {
  it('цель «Интервалы» только у бега; старт пишет интервалы и показывает разминку', async () => {
    const r = await setup()
    // экран бега считает по настоящим часам — пробежка должна начаться «сейчас»
    r.clock.set(new Date())
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition: () => 1, clearWatch: () => {} },
    })
    const router = createMemoryRouter(routes, { initialEntries: ['/run'] })
    render(
      <DataProvider repos={r}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    const goals = await screen.findByRole('group', { name: 'Цель' })
    await user.click(screen.getByRole('button', { name: 'Ходьба' }))
    expect(within(goals).queryByRole('button', { name: 'Интервалы' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Бег' }))
    await user.click(within(goals).getByRole('button', { name: 'Интервалы' }))

    const presets = screen.getByRole('group', { name: 'Готовые интервалы' })
    expect(within(presets).getByRole('button', { name: /Новичок/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(presets).getByRole('button', { name: /Втягиваюсь/ }))
    await user.click(screen.getByRole('button', { name: 'Повторов: увеличить на 1' }))
    expect(screen.getByRole('status')).toHaveTextContent('Бег 2 мин / шаг 2 мин × 7 — всего 31 мин')
    expect(within(presets).getByRole('button', { name: /Втягиваюсь/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'Старт' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/run/active'))
    const phase = await screen.findByRole('region', { name: 'Интервалы' })
    expect(phase).toHaveTextContent('Разминка')
    expect(phase).toHaveTextContent('Шагом · потом 7 × бег 2 мин')

    const run = await r.runs.getActive()
    expect(run?.intervals).toEqual({ warmupSec: 300, runSec: 120, walkSec: 120, rounds: 7 })
    expect(run?.goal).toEqual({ type: 'time', sec: 31 * 60 })
  })
})
