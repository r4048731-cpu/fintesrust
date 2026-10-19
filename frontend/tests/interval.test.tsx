// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import {
  clockElapsed,
  INTERVAL_DEFAULTS,
  intervalPhases,
  intervalPosition,
  intervalTotalSec,
  INTERVAL_PRESETS,
  presetMinutes,
  pauseClock,
  phaseStartMs,
  resumeClock,
  seekClock,
  type IntervalClock,
} from '../src/domain/interval'
import { setup } from './helpers'

const signals = vi.hoisted(() => [] as string[])
vi.mock('../src/app/signal', async (orig) => ({
  ...(await orig<typeof import('../src/app/signal')>()),
  intervalSignal: (kind: string) => signals.push(kind),
}))

describe('фазы интервального таймера', () => {
  it('табата: подготовка, 8 × (20 работы + 10 отдыха) без отдыха после последнего', () => {
    const phases = intervalPhases('tabata', INTERVAL_DEFAULTS.tabata)
    expect(phases[0]).toMatchObject({ kind: 'prepare', durationSec: 10 })
    expect(phases.filter((p) => p.kind === 'work')).toHaveLength(8)
    expect(phases.filter((p) => p.kind === 'rest')).toHaveLength(7)
    expect(phases.at(-1)).toMatchObject({ kind: 'work', round: 8 })
    expect(intervalTotalSec(phases)).toBe(8 * 20 + 7 * 10)
  })

  it('EMOM — только интервалы, отдых не вставляется', () => {
    const phases = intervalPhases('emom', { ...INTERVAL_DEFAULTS.emom, restSec: 30 })
    expect(phases.slice(1).every((p) => p.kind === 'work' && p.durationSec === 60)).toBe(true)
    expect(intervalTotalSec(phases)).toBe(600)
  })

  it('круговая: отдых между кругами вместо отдыха после последнего упражнения', () => {
    const phases = intervalPhases('circuit', {
      workSec: 30,
      restSec: 10,
      rounds: 3,
      laps: 2,
      lapRestSec: 60,
    })
    expect(phases.map((p) => p.kind)).toEqual([
      'prepare',
      'work',
      'rest',
      'work',
      'rest',
      'work',
      'lapRest',
      'work',
      'rest',
      'work',
      'rest',
      'work',
    ])
    expect(phases[6]).toMatchObject({ lap: 2, round: 1 })
  })

  it('положение по прошедшему времени', () => {
    const phases = intervalPhases('tabata', INTERVAL_DEFAULTS.tabata)
    expect(intervalPosition(phases, 0)).toMatchObject({ index: 0, remainingMs: 10_000 })
    expect(intervalPosition(phases, 15_000)).toMatchObject({ index: 1, remainingMs: 15_000 })
    expect(intervalPosition(phases, 31_000)).toMatchObject({ index: 2, remainingMs: 9_000 })
    expect(intervalPosition(phases, 10_000_000).done).toBe(true)
    expect(phaseStartMs(phases, 2)).toBe(30_000)
  })

  it('пауза не идёт в счёт, «пропустить» перескакивает к началу фазы', () => {
    let c: IntervalClock = { startedAt: 1000, pausedAt: null, pausedMs: 0 }
    c = pauseClock(c, 6000)
    expect(clockElapsed(c, 60_000)).toBe(5000)
    c = resumeClock(c, 60_000)
    expect(clockElapsed(c, 61_000)).toBe(6000)
    c = seekClock(c, 61_000, 30_000)
    expect(clockElapsed(c, 61_000)).toBe(30_000)
  })
})

describe('готовые варианты', () => {
  it('длительность вместе с подготовкой, целыми минутами', () => {
    expect(INTERVAL_PRESETS.map((p) => `${p.id} ${presetMinutes(p)}`)).toEqual([
      'tabata 4',
      'tabata-x2 9',
      'emom-10 10',
      'emom-20 20',
      'circuit-10 10',
      'circuit-20 20',
    ])
  })
})

describe('экран интервального таймера', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    signals.length = 0
  })

  it('запускается, гудит на смене фаз и запоминает настройки', async () => {
    let now = new Date(2026, 9, 18, 10).getTime()
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const repos = await setup()
    const router = createMemoryRouter(routes, { initialEntries: ['/interval'] })
    render(
      <DataProvider repos={repos}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Табата' }))
    const rounds = screen.getByLabelText('Раундов')
    await user.clear(rounds)
    await user.type(rounds, '2{Enter}')
    // 2 × 20 работы + 10 отдыха между
    expect(screen.getByRole('status')).toHaveTextContent('Всего 0:50')

    await user.click(screen.getByRole('button', { name: 'Старт' }))
    expect(await screen.findByText('Приготовьтесь')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')

    now += 12_000
    expect(await screen.findByText('Работа')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('0:18'))
    expect(screen.getByText('Раунд 1 из 2')).toBeInTheDocument()
    expect(signals).toContain('work')

    await user.click(screen.getByRole('button', { name: 'Пауза' }))
    now += 60_000
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('0:18'))

    await user.click(screen.getByRole('button', { name: 'Пропустить' }))
    expect(await screen.findByText('Отдых')).toBeInTheDocument()
    expect(signals).toContain('rest')

    now += 60_000
    expect(await screen.findByText('Готово!')).toBeInTheDocument()
    expect(signals.at(-1)).toBe('finish')

    expect(await repos.meta.get('intervalTimer')).toMatchObject({
      mode: 'tabata',
      configs: { tabata: { rounds: 2, workSec: 20 } },
    })
  })

  it('готовый вариант выставляет режим и цифры', async () => {
    const repos = await setup()
    render(
      <DataProvider repos={repos}>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/interval'] })} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    const presets = await screen.findByRole('group', { name: 'Готовые варианты' })
    await user.click(within(presets).getByRole('button', { name: 'EMOM 20 мин' }))
    expect(screen.getByRole('button', { name: 'EMOM', pressed: true })).toBeInTheDocument()
    expect(screen.getByLabelText('Интервалов')).toHaveValue('20')
    expect(screen.getByRole('status')).toHaveTextContent('Всего 20:00')
    expect(within(presets).getByRole('button', { name: 'EMOM 20 мин' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // поменяли цифру — вариант больше не выделен
    await user.click(screen.getByRole('button', { name: 'Интервалов: увеличить на 1' }))
    expect(within(presets).getByRole('button', { name: 'EMOM 20 мин' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
