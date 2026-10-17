// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { createBackup, parseBackup, restoreBackup, wipeAll } from '../src/data/backup'
import {
  acceptFix,
  addFix,
  climb,
  distanceM,
  finishRun,
  formatKm,
  formatPace,
  paceSecPerKm,
  pauseRun,
  resumeRun,
  runTotals,
  splits,
  type Run,
  type TrackPoint,
} from '../src/domain/run'
import { setup } from './helpers'

/** Шаг на север примерно в 11,1 м. */
const STEP = 0.0001
const LAT0 = 55.75
const LON0 = 37.62

const base = (over: Partial<Run> = {}): Run => ({
  id: 'r',
  kind: 'run',
  goal: { type: 'free' },
  status: 'active',
  startedAt: 0,
  finishedAt: null,
  segments: [[]],
  movingMs: 0,
  resumedAt: 0,
  distanceM: 0,
  climbM: 0,
  bodyKg: 70,
  updatedAt: 0,
  deletedAt: null,
  ...over,
})

describe('бег: расчёты', () => {
  it('расстояние, отсев плохих точек и скачков', () => {
    expect(distanceM([LAT0, LON0], [LAT0 + 0.009, LON0])).toBeCloseTo(1000.8, 0)
    const last: TrackPoint = [LAT0, LON0, 0, null]
    const fix = (dLat: number, sec: number, accuracy = 5) => ({
      lat: LAT0 + dLat,
      lon: LON0,
      accuracy,
      alt: null,
      t: sec * 1000,
    })
    expect(acceptFix(last, fix(STEP, 3), 'run')).toBe(true)
    expect(acceptFix(last, fix(STEP, 3, 80), 'run')).toBe(false) // неточная
    expect(acceptFix(last, fix(STEP / 10, 3), 'run')).toBe(false) // дрожание на месте
    expect(acceptFix(last, fix(STEP * 10, 3), 'run')).toBe(false) // 111 м за 3 с — скачок
    expect(acceptFix(last, fix(STEP, 2), 'walk')).toBe(false) // 5,5 м/с пешком не бывает
  })

  it('пауза разрывает маршрут, время в движении без паузы, отрезки по километрам', () => {
    let run = base()
    // 1-й км: 90 шагов по 11,1 м каждые 3 с; пауза 10 минут; потом ещё 100 шагов
    for (let i = 0; i <= 90; i++) {
      run = addFix(run, {
        lat: LAT0 + i * STEP,
        lon: LON0,
        accuracy: 5,
        alt: 100 + i * 0.1,
        t: i * 3000,
      })
    }
    run = pauseRun(run, 270_000)
    run = resumeRun(run, 870_000)
    for (let i = 0; i <= 100; i++) {
      run = addFix(run, {
        lat: LAT0 + (91 + i) * STEP,
        lon: LON0,
        accuracy: 5,
        alt: 109,
        t: 870_000 + i * 3000,
      })
    }
    run = finishRun(run, 1_170_000)
    expect(run.segments).toHaveLength(2)
    expect(run.movingMs).toBe(570_000) // 270 с + 300 с
    expect(formatKm(run.distanceM)).toBe('2,11')
    // первый километр ≈ 270 с; пауза в отрезки не попадает
    const s = splits(run.segments)
    expect(s).toHaveLength(2)
    expect(s[0]).toBeGreaterThan(260)
    expect(s[0]).toBeLessThan(280)
    expect(s[1]).toBeLessThan(300)
    expect(formatPace(paceSecPerKm(run.distanceM, run.movingMs))).toMatch(/^4:\d\d$/)
    // подъёмы меньше 2 м не копятся: из 9 м набора засчитано 8
    expect(climb(run.segments[0])).toBe(8)
    const t = runTotals([run])
    expect(t).toMatchObject({ count: 1, calories: 148 })
  })
})

describe('бег: экран', () => {
  it('старт → GPS пишет маршрут → завершить → детали и история; переживает бэкап', async () => {
    const r = await setup()
    let send: ((p: GeolocationPosition) => void) | null = null
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (ok: (p: GeolocationPosition) => void) => {
          send = ok
          return 1
        },
        clearWatch: () => {},
      },
    })
    const router = createMemoryRouter(routes, { initialEntries: ['/run'] })
    render(
      <DataProvider repos={r}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    await user.click(
      within(await screen.findByRole('group', { name: 'Цель' })).getByRole('button', {
        name: '3 км',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Старт' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/run/active'))
    await waitFor(() => expect(send).not.toBeNull())

    const t0 = Date.now()
    await act(async () => {
      for (let i = 0; i <= 100; i++) {
        send!({
          coords: { latitude: LAT0 + i * STEP, longitude: LON0, accuracy: 5, altitude: null },
          timestamp: t0 + i * 3000,
        } as GeolocationPosition)
      }
    })
    const board = screen.getByRole('region', { name: 'Показатели' })
    expect(board).toHaveTextContent('1,11км')
    expect(within(board).getByLabelText(/Цель: 37%/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Завершить' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Завершить пробежку?' })).getByRole('button', {
        name: 'Завершить',
      }),
    )
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/run\/(?!active)/))
    expect(await screen.findByRole('list', { name: 'Темп по километрам' })).toBeInTheDocument()

    const runs = await r.runs.list()
    expect(runs).toHaveLength(1)
    expect(Math.round(runs[0].distanceM)).toBe(1112)

    const file = JSON.stringify(await createBackup(r.db, r.clock()))
    await wipeAll(r.db)
    await restoreBackup(r.db, parseBackup(file))
    expect(await r.runs.list()).toEqual(runs)
  })

  it('без https кнопка «Старт» недоступна и объяснено почему', async () => {
    const r = await setup()
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    const router = createMemoryRouter(routes, { initialEntries: ['/run'] })
    render(
      <DataProvider repos={r}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    expect(await screen.findByRole('button', { name: 'Старт' })).toBeDisabled()
    expect(screen.getByRole('note')).toHaveTextContent('https://')
  })
})
