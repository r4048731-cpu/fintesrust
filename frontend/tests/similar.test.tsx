// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { routes } from '../src/app/routes'
import { builtinExercises } from '../src/data/seed'
import { replacePlanItem } from '../src/domain/programs'
import { gearLabel, similarExercises } from '../src/domain/similar'
import { setup } from './helpers'

const all = builtinExercises(0)
const ex = (id: string) => all.find((e) => e.id === `builtin-${id}`)!
const names = (list: { name: string }[]) => list.map((e) => e.name)

describe('похожие упражнения', () => {
  it('сначала то же движение, потом та же группа мышц', () => {
    const list = similarExercises(ex('bench-press'), all)
    expect(names(list).slice(0, 5)).toEqual([
      'Жим гантелей лёжа',
      'Жим от груди в тренажёре',
      'Отжимания от пола',
      'Жим гантелей на наклонной скамье',
      'Жим штанги на наклонной скамье',
    ])
    expect(list).toHaveLength(8)
    expect(list.every((e) => e.muscle === 'chest')).toBe(true)
    expect(names(similarExercises(ex('lat-pulldown'), all))).toContain('Подтягивания')
  })

  it('своё упражнение — по группе мышц, сначала того же типа; удалённые не предлагаются', () => {
    const own = { ...ex('plank'), id: 'own', name: 'Вакуум', builtin: false }
    const list = similarExercises(own, [...all, own])
    expect(list[0]).toMatchObject({ muscle: 'core', type: 'time' })
    const gone = { ...ex('db-bench-press'), deletedAt: 1 }
    const rest = similarExercises(
      ex('bench-press'),
      all.map((e) => (e.id === gone.id ? gone : e)),
    )
    expect(names(rest)).not.toContain('Жим гантелей лёжа')
  })

  it('инвентарь по названию', () => {
    expect(gearLabel(ex('bench-press'))).toBe('Штанга')
    expect(gearLabel(ex('incline-db-press'))).toBe('Гантели')
    expect(gearLabel(ex('lat-pulldown'))).toBe('Блок')
    expect(gearLabel(ex('leg-press'))).toBe('Тренажёр')
    expect(gearLabel(ex('pull-up'))).toBe('Турник')
    expect(gearLabel(ex('inverted-row'))).toBe('Без инвентаря')
    expect(gearLabel(ex('romanian-deadlift'))).toBeNull()
  })

  it('замена в плане: подходы и отдых остаются, вес сбрасывается', () => {
    const item = {
      exerciseId: 'builtin-bench-press',
      sets: 4,
      repsMin: 6,
      repsMax: 8,
      weightKg: 60,
      restSec: 150,
      superset: 'a',
    }
    expect(replacePlanItem(item, ex('bench-press'), ex('db-bench-press'))).toEqual({
      ...item,
      exerciseId: 'builtin-db-bench-press',
      weightKg: 0,
    })
    expect(replacePlanItem(item, ex('bench-press'), ex('plank'))).toMatchObject({
      sets: 4,
      repsMin: 30,
      repsMax: 60,
      restSec: 150,
      superset: 'a',
    })
  })
})

describe('«Заменить» в редакторе программы', () => {
  it('предлагает похожие сверху и меняет упражнение в дне', async () => {
    const repos = await setup()
    const p = await repos.programs.create('Верх / Низ', 'upperlower')
    const router = createMemoryRouter(routes, { initialEntries: [`/programs/${p.id}`] })
    render(
      <DataProvider repos={repos}>
        <RouterProvider router={router} />
      </DataProvider>,
    )
    const user = userEvent.setup()
    const [first] = await screen.findAllByRole('button', { name: /Жим штанги лёжа/ })
    await user.click(first)
    await user.click(screen.getByRole('button', { name: 'Заменить «Жим штанги лёжа»' }))

    const picker = screen.getByRole('dialog', { name: 'Заменить на' })
    const similar = within(picker).getByRole('region', { name: 'Похожие' })
    const option = within(similar).getAllByRole('button')[0]
    expect(option).toHaveTextContent('Жим гантелей лёжа')
    expect(option).toHaveTextContent('Грудь · Гантели')
    await user.click(option)

    await waitFor(async () =>
      expect((await repos.programs.get(p.id))!.days[0].items[0]).toMatchObject({
        exerciseId: 'builtin-db-bench-press',
        sets: 4,
        weightKg: 0,
      }),
    )
  })
})
