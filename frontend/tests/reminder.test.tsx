// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { TrainingReminderSettings } from '../src/components/reminder/TrainingReminderSettings'
import { TrainingReminderSync } from '../src/components/reminder/TrainingReminderSync'
import { lastDoneDate, reminderSummary, reminderTitle } from '../src/domain/reminder'
import type { Workout } from '../src/domain/types'
import { setup } from './helpers'

// мост к Android подменяется: в тестах телефона нет
const bridge = vi.hoisted(() => ({
  getTrainingReminder: vi.fn(),
  setTrainingReminder: vi.fn(),
  testTrainingReminder: vi.fn(),
  setTrainingInfo: vi.fn(),
}))
vi.mock('../src/native/workoutAlerts', () => ({
  WorkoutAlerts: bridge,
  setTrainingInfo: (next: string, doneDate: string) => bridge.setTrainingInfo({ next, doneDate }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  bridge.getTrainingReminder.mockResolvedValue({
    enabled: false,
    hour: 19,
    minute: 0,
    days: [1, 3, 5],
  })
  bridge.setTrainingReminder.mockResolvedValue(undefined)
  bridge.testTrainingReminder.mockResolvedValue(undefined)
})

describe('напоминание о тренировке: тексты', () => {
  it('заголовок, последняя тренировка, подпись дней', () => {
    expect(reminderTitle({ id: 'd', name: 'Верх A', items: Array(6).fill(null) })).toBe(
      'Верх A · 6 упражнений',
    )
    expect(reminderTitle({ id: 'd', name: 'Ноги', items: [] })).toBe('Ноги')
    expect(reminderTitle(null)).toBe('')
    const w = (date: string, status: Workout['status'], deletedAt: number | null = null) =>
      ({ date, status, deletedAt }) as Workout
    expect(
      lastDoneDate([
        w('2026-10-10', 'done'),
        w('2026-10-15', 'done', 1),
        w('2026-10-20', 'planned'),
      ]),
    ).toBe('2026-10-10')
    expect(lastDoneDate([])).toBe('')
    expect(reminderSummary([1, 3, 5], '07:30')).toBe('Пн, Ср, Пт в 7:30')
    expect(reminderSummary([1, 2, 3, 4, 5, 6, 7], '19:00')).toBe('Каждый день в 19:00')
    expect(reminderSummary([], '19:00')).toBe('Дни не выбраны')
  })
})

describe('«Настройки» → напоминание', () => {
  it('включает, меняет дни и время', async () => {
    const user = userEvent.setup()
    render(<TrainingReminderSettings />)
    await user.click(await screen.findByRole('checkbox', { name: 'Напоминать в дни тренировок' }))
    expect(bridge.setTrainingReminder).toHaveBeenLastCalledWith({
      enabled: true,
      hour: 19,
      minute: 0,
      days: [1, 3, 5],
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Напомню: Пн, Ср, Пт в 19:00')

    const days = screen.getByRole('group', { name: 'Дни недели' })
    expect(within(days).getByRole('button', { name: 'Пн' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(days).getByRole('button', { name: 'Сб' }))
    await user.click(within(days).getByRole('button', { name: 'Ср' }))
    await waitFor(() =>
      expect(bridge.setTrainingReminder).toHaveBeenLastCalledWith(
        expect.objectContaining({ days: [1, 5, 6] }),
      ),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Пн, Пт, Сб в 19:00')
  })

  it('уведомления запрещены — напоминание остаётся выключенным', async () => {
    bridge.setTrainingReminder.mockRejectedValue(new Error('Уведомления запрещены'))
    const user = userEvent.setup()
    render(<TrainingReminderSettings />)
    const box = await screen.findByRole('checkbox', { name: 'Напоминать в дни тренировок' })
    await user.click(box)
    expect(await screen.findByRole('status')).toHaveTextContent('Уведомления запрещены')
    expect(box).not.toBeChecked()
  })
})

describe('синхронизация с телефоном', () => {
  it('передаёт следующий день активной программы и дату последней тренировки', async () => {
    const r = await setup()
    const p = await r.programs.create('Фулбади', 'fullbody')
    render(
      <DataProvider repos={r}>
        <TrainingReminderSync />
      </DataProvider>,
    )
    await waitFor(() =>
      expect(bridge.setTrainingInfo).toHaveBeenLastCalledWith({
        next: 'Фулбади A · 5 упражнений',
        doneDate: '',
      }),
    )

    const w = await r.workouts.start({ programId: p.id, dayId: p.days[0].id })
    w.entries[0].sets[0].done = true
    await r.workouts.save(w)
    await r.workouts.finish(w.id)
    await waitFor(() =>
      expect(bridge.setTrainingInfo).toHaveBeenLastCalledWith({
        next: 'Фулбади B · 5 упражнений',
        doneDate: w.date,
      }),
    )
  })
})
