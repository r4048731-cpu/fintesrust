// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import {
  deloadActive,
  deloadAdvice,
  deloadEntries,
  endDeload,
  startDeload,
  trainingBlock,
} from '../src/domain/deload'
import { toISODate } from '../src/domain/metrics'
import type { Workout, WorkoutEntry, WorkoutSet } from '../src/domain/types'
import { DAY, setup } from './helpers'

const done = (weightKg: number, reps = 8): WorkoutSet => ({ weightKg, reps, done: true })

/** Завершённая тренировка в день `date` с жимом заданного рабочего веса. */
function workout(date: string, kg: number, id = date): Workout {
  return {
    id,
    date,
    name: 'Тренировка',
    programId: null,
    dayId: null,
    status: 'done',
    startedAt: 0,
    finishedAt: 1,
    note: '',
    entries: [{ exerciseId: 'bench', restSec: 90, plan: null, sets: [done(kg), done(kg)] }],
    exerciseIds: ['bench'],
    updatedAt: 0,
    deletedAt: null,
  }
}

// Понедельники: 2026-09-07, 14, 21, 28, 10-05, 10-12
const WEEKS = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12']

describe('блок тренировок для разгрузки', () => {
  it('считает недели подряд, а пропущенная неделя обрывает блок', () => {
    const ws = WEEKS.map((d, i) => workout(d, 60 + i * 2.5))
    expect(trainingBlock(ws, null, '2026-10-14')).toEqual({ weeks: 6, rising: 1, falling: 0 })
    // На этой неделе ещё не тренировались — считаем от прошлой
    expect(trainingBlock(ws, null, '2026-10-19').weeks).toBe(6)
    const gap = ws.filter((w) => w.date !== '2026-09-21')
    expect(trainingBlock(gap, null, '2026-10-14').weeks).toBe(3)
  })

  it('прошлая разгрузка начинает новый блок', () => {
    const ws = WEEKS.map((d, i) => workout(d, 60 + i * 2.5))
    expect(trainingBlock(ws, '2026-09-20', '2026-10-14').weeks).toBe(4)
  })

  it('подсказка с 4 недель, «пора» с 6, и только когда веса растут', () => {
    expect(deloadAdvice({ weeks: 3, rising: 2, falling: 0 })).toBeNull()
    expect(deloadAdvice({ weeks: 4, rising: 2, falling: 0 })).toEqual({ level: 'maybe', weeks: 4 })
    expect(deloadAdvice({ weeks: 6, rising: 2, falling: 1 })).toEqual({ level: 'due', weeks: 6 })
    expect(deloadAdvice({ weeks: 8, rising: 1, falling: 1 })).toBeNull()
    expect(deloadAdvice({ weeks: 8, rising: 0, falling: 0 })).toBeNull()
  })

  it('неделя разгрузки: 7 дней, можно закончить раньше', () => {
    const week = startDeload('2026-10-14')
    expect(week).toEqual({ from: '2026-10-14', until: '2026-10-20' })
    expect(deloadActive(week, '2026-10-20')).toBe(true)
    expect(deloadActive(week, '2026-10-21')).toBe(false)
    const ended = endDeload(week, '2026-10-16')
    expect(deloadActive(ended, '2026-10-16')).toBe(false)
    expect(ended.until).toBe('2026-10-15')
  })

  it('подходов на 40 % меньше, но не меньше одного; веса те же', () => {
    const entry = (n: number): WorkoutEntry => ({
      exerciseId: 'x',
      restSec: 90,
      plan: { sets: n, repsMin: 8, repsMax: 10, weightKg: 60 },
      sets: Array.from({ length: n }, () => ({ ...done(60), done: false })),
    })
    const [a, b, c] = deloadEntries([entry(5), entry(3), entry(1)])
    expect(a.sets).toHaveLength(3)
    expect(a.plan?.sets).toBe(3)
    expect(a.sets[0].weightKg).toBe(60)
    expect(b.sets).toHaveLength(2)
    expect(c.sets).toHaveLength(1)
  })
})

/** Пять недель подряд жим растёт: по тренировке в неделю, последняя — вчера. */
async function withGrowth() {
  const r = await setup()
  const now = new Date()
  for (let i = 4; i >= 0; i--) {
    r.clock.set(new Date(now.getTime() - (i * 7 + 1) * DAY))
    const w = await r.workouts.start(null)
    const e = await r.workouts.buildEntry('builtin-bench-press', null)
    w.entries.push({ ...e, sets: [done(60 + (4 - i) * 2.5), done(60 + (4 - i) * 2.5)] })
    await r.workouts.save(w)
    await r.workouts.finish(w.id)
  }
  r.clock.set(now)
  const p = await r.programs.create('Верх / Низ', 'upperlower')
  await r.programs.setActive(p.id)
  render(
    <DataProvider repos={r}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />
    </DataProvider>,
  )
  return { r, p, now, user: userEvent.setup() }
}

describe('разгрузка в приложении', () => {
  it('«Сегодня» предлагает разгрузку, и тренировка по программе выходит короче', async () => {
    const { r, p, now, user } = await withGrowth()
    const card = await screen.findByRole('region', { name: 'Неделя разгрузки' })
    expect(card).toHaveTextContent('Может, неделю разгрузки?')
    expect(card).toHaveTextContent('5 недель подряд')

    await user.click(within(card).getByRole('button', { name: 'Начать разгрузку' }))
    expect(await screen.findByText(/Неделя разгрузки · до/)).toBeInTheDocument()
    expect(await r.meta.get('deload')).toMatchObject({ from: toISODate(now) })

    const day = (await r.programs.nextDay(p.id))!.day
    const w = await r.workouts.start({ programId: p.id, dayId: day.id })
    expect(w.name).toBe(`${day.name} · разгрузка`)
    expect(w.entries.map((e) => e.sets.length)).toEqual(
      day.items.map((i) => Math.max(1, Math.round(i.sets * 0.6))),
    )
  })

  it('«Не сейчас» прячет подсказку на неделю', async () => {
    const { r, user } = await withGrowth()
    const card = await screen.findByRole('region', { name: 'Неделя разгрузки' })
    await user.click(within(card).getByRole('button', { name: 'Не сейчас' }))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Неделя разгрузки' })).not.toBeInTheDocument(),
    )
    expect(await r.meta.get('deloadSnoozedUntil')).toBe(toISODate(new Date(Date.now() + 6 * DAY)))
  })
})
