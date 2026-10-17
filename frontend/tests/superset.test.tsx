// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { linkedToNext, normalizeSupersets, toggleLink } from '../src/domain/superset'
import type { PlanItem, Workout, WorkoutEntry } from '../src/domain/types'
import {
  moveEntry,
  nextOpenSet,
  removeEntry,
  replaceEntry,
  toggleDone,
  toggleSuperset,
} from '../src/domain/workout'
import { setup } from './helpers'

type Repos = Awaited<ReturnType<typeof setup>>

const entry = (exerciseId: string, sets = 2, restSec = 90): WorkoutEntry => ({
  exerciseId,
  restSec,
  plan: null,
  sets: Array.from({ length: sets }, () => ({ weightKg: 20, reps: 10, done: false })),
})
const workout = (entries: WorkoutEntry[]): Workout => ({
  id: 'w',
  date: '2026-10-17',
  name: 'Т',
  programId: null,
  dayId: null,
  status: 'active',
  startedAt: 0,
  finishedAt: null,
  note: '',
  entries,
  exerciseIds: [],
  updatedAt: 0,
  deletedAt: null,
})

describe('суперсеты: логика', () => {
  it('объединить, разъединить, порядок групп после перестановки и удаления', () => {
    let list = [entry('a'), entry('b'), entry('c')]
    list = toggleLink(list, 0)
    expect(linkedToNext(list, 0)).toBe(true)
    expect(list[2].superset).toBeUndefined()
    // присоединить третье — вся тройка в одной группе
    list = toggleLink(list, 1)
    expect(new Set(list.map((e) => e.superset)).size).toBe(1)
    // разрезать между первым и вторым: b+c остаются суперсетом, a — одно
    list = toggleLink(list, 0)
    expect(list[0].superset).toBeUndefined()
    expect(linkedToNext(list, 1)).toBe(true)

    // перестановка разрывает группу — одиночки теряют метку
    const w = moveEntry(workout(list), 2, -1)
    expect(w.entries.map((e) => e.exerciseId)).toEqual(['a', 'c', 'b'])
    expect(linkedToNext(w.entries, 1)).toBe(true)
    const removed = removeEntry(w, 1)
    expect(removed.entries.every((e) => !e.superset)).toBe(true)

    // разорванная группа с одной меткой получает две разные
    const split = normalizeSupersets([
      { superset: 'x' },
      { superset: 'x' },
      {},
      { superset: 'x' },
      { superset: 'x' },
    ])
    expect(split[0].superset).toBe(split[1].superset)
    expect(split[3].superset).toBe(split[4].superset)
    expect(split[0].superset).not.toBe(split[3].superset)
  })

  it('по кругу без отдыха внутри круга, отдых после последнего; следующий подход — по кругу', () => {
    let w = toggleSuperset(workout([entry('a', 2, 60), entry('b', 2, 120), entry('c', 1)]), 0)
    expect(nextOpenSet(w)).toEqual({ ei: 0, si: 0 })
    w = toggleDone(w, 0, 0, 1000)
    expect(w.restEndsAt ?? null).toBeNull() // круг не закончен — без отдыха
    expect(nextOpenSet(w)).toEqual({ ei: 1, si: 0 })
    w = toggleDone(w, 1, 0, 1000)
    expect(w.restEndsAt).toBe(1000 + 120 * 1000) // отдых последнего упражнения круга
    expect(nextOpenSet(w)).toEqual({ ei: 0, si: 1 })

    // замена упражнения: суперсет остаётся, заметка — нет
    const noted = { ...w, entries: w.entries.map((e, i) => (i === 0 ? { ...e, note: 'x' } : e)) }
    const replaced = replaceEntry(noted, 0, entry('d'))
    expect(replaced.entries[0]).toMatchObject({ exerciseId: 'd', superset: w.entries[0].superset })
    expect(replaced.entries[0].note).toBeUndefined()
  })

  it('суперсет из программы переходит в тренировку; прошлая заметка находится', async () => {
    const r = await setup()
    const p = await r.programs.create('П')
    p.days[0].items = toggleLink<PlanItem>(
      [
        {
          exerciseId: 'builtin-bench-press',
          sets: 2,
          repsMin: 8,
          repsMax: 10,
          weightKg: 60,
          restSec: 90,
        },
        {
          exerciseId: 'builtin-barbell-row',
          sets: 2,
          repsMin: 8,
          repsMax: 10,
          weightKg: 50,
          restSec: 90,
        },
        {
          exerciseId: 'builtin-squat',
          sets: 2,
          repsMin: 5,
          repsMax: 5,
          weightKg: 80,
          restSec: 120,
        },
      ],
      0,
    )
    await r.programs.save(p)
    const w = await r.workouts.start({ programId: p.id, dayId: p.days[0].id })
    expect(linkedToNext(w.entries, 0)).toBe(true)
    expect(w.entries[2].superset).toBeUndefined()

    w.entries[0] = {
      ...w.entries[0],
      note: 'Скамья на 3',
      sets: w.entries[0].sets.map((s) => ({ ...s, done: true })),
    }
    await r.workouts.save(w)
    await r.workouts.finish(w.id)
    expect(await r.workouts.lastNote('builtin-bench-press')).toBe('Скамья на 3')
  })
})

function renderAt(path: string, repos: Repos) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <DataProvider repos={repos}>
      <RouterProvider router={router} />
    </DataProvider>,
  )
  return { router, user: userEvent.setup() }
}

describe('суперсеты и заметка: экраны', () => {
  it('тренировка: объединить, после подхода — сразу следующее упражнение, отдых после круга', async () => {
    const r = await setup()
    const w = await r.workouts.start(null)
    w.entries.push(await r.workouts.buildEntry('builtin-bench-press', null, w.id))
    w.entries.push(await r.workouts.buildEntry('builtin-barbell-row', null, w.id))
    await r.workouts.save(w)
    const { user } = renderAt('/workout', r)

    await user.click(
      await screen.findByRole('button', { name: 'Суперсет: «Жим штанги лёжа» и следующее' }),
    )
    expect(await screen.findByRole('button', { name: /^Жим штанги лёжа —/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Жим штанги лёжа —/ }).parentElement,
    ).toHaveTextContent('суперсет')

    await user.click(screen.getByRole('button', { name: /^Жим штанги лёжа —/ }))
    const bench = await screen.findByRole('dialog', { name: 'Жим штанги лёжа' })
    await user.click(within(bench).getAllByRole('button', { name: 'Подход 1 выполнен' })[0])
    // круг не закончен: отдыха нет, шторка перешла к тяге
    const row = await screen.findByRole('dialog', { name: 'Тяга штанги в наклоне' })
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    await user.click(within(row).getAllByRole('button', { name: 'Подход 1 выполнен' })[0])
    expect(await within(row).findByRole('timer', { name: 'Отдых' })).toBeInTheDocument()

    // заметка к упражнению сохраняется вместе с тренировкой
    await user.type(within(row).getByRole('textbox', { name: 'Заметка к упражнению' }), 'Хват шире')
    await waitFor(async () =>
      expect((await r.workouts.getActive())?.entries[1].note).toBe('Хват шире'),
    )
  })

  it('программа: кнопка суперсета связывает упражнения дня', async () => {
    const r = await setup()
    const p = await r.programs.create('П')
    p.days[0].items = [
      {
        exerciseId: 'builtin-bench-press',
        sets: 3,
        repsMin: 8,
        repsMax: 10,
        weightKg: 60,
        restSec: 90,
      },
      {
        exerciseId: 'builtin-barbell-row',
        sets: 3,
        repsMin: 8,
        repsMax: 10,
        weightKg: 50,
        restSec: 90,
      },
    ]
    await r.programs.save(p)
    const { user } = renderAt(`/programs/${p.id}`, r)
    await user.click(
      await screen.findByRole('button', { name: 'Суперсет: «Жим штанги лёжа» и следующее' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Разъединить суперсет после «Жим штанги лёжа»' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await waitFor(async () => {
      const saved = await r.programs.get(p.id)
      expect(linkedToNext(saved!.days[0].items, 0)).toBe(true)
    })
  })
})
