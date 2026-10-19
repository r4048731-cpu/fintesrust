import { useEffect, useState } from 'react'
import { reminderSummary, WEEKDAYS, type Weekday } from '../../domain/reminder'
import { WorkoutAlerts, type TrainingReminder } from '../../native/workoutAlerts'
import { Button } from '../Button'
import { Card, SectionLabel } from '../Screen'
import steps from '../steps/Steps.module.css'
import styles from './TrainingReminderSettings.module.css'

const pad = (n: number) => String(n).padStart(2, '0')
const DEFAULT: TrainingReminder = { enabled: false, hour: 19, minute: 0, days: [1, 3, 5] }

/** «Настройки» → «Напоминание о тренировке» (Android-версия): дни недели и время. */
export function TrainingReminderSettings() {
  const [state, setState] = useState<TrainingReminder>(DEFAULT)
  const [message, setMessage] = useState<string | null>(null)
  const time = `${pad(state.hour)}:${pad(state.minute)}`

  useEffect(() => {
    void WorkoutAlerts.getTrainingReminder()
      .then(setState)
      .catch(() => {})
  }, [])

  async function save(patch: Partial<TrainingReminder>) {
    const next = { ...state, ...patch }
    setMessage(null)
    try {
      await WorkoutAlerts.setTrainingReminder(next)
      setState(next)
      setMessage(
        next.enabled
          ? `Напомню: ${reminderSummary(next.days, `${pad(next.hour)}:${pad(next.minute)}`)}`
          : 'Напоминание выключено',
      )
    } catch (err) {
      setState({ ...next, enabled: false })
      setMessage(err instanceof Error ? err.message : 'Не удалось сохранить')
    }
  }

  function toggleDay(day: Weekday) {
    const days = state.days.includes(day)
      ? state.days.filter((d) => d !== day)
      : [...state.days, day].sort((a, b) => a - b)
    void save({ days })
  }

  return (
    <>
      <SectionLabel>Напоминание о тренировке</SectionLabel>
      <Card>
        <div className={steps.settings}>
          <label className={steps.toggle}>
            <input
              type="checkbox"
              checked={state.enabled}
              onChange={(e) => void save({ enabled: e.target.checked })}
            />
            Напоминать в дни тренировок
          </label>
          {state.enabled && (
            <>
              <div className={styles.days} role="group" aria-label="Дни недели">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={styles.day}
                    aria-pressed={state.days.includes(d.value)}
                    onClick={() => toggleDay(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <label className={steps.setting}>
                <span>Время</span>
                <input
                  type="time"
                  className={steps.time}
                  value={time}
                  onChange={(e) => {
                    if (!e.target.value) return
                    const [hour, minute] = e.target.value.split(':').map(Number)
                    void save({ hour, minute })
                  }}
                />
              </label>
              <p className={steps.muted}>
                В уведомлении — следующий день активной программы. Если в этот день тренировка уже
                была, напоминания не будет.
              </p>
            </>
          )}
          {message && (
            <p className={steps.muted} role="status">
              {message}
            </p>
          )}
          <Button
            size="sm"
            onClick={() => void WorkoutAlerts.testTrainingReminder().catch(() => {})}
          >
            Показать уведомление сейчас
          </Button>
        </div>
      </Card>
    </>
  )
}
