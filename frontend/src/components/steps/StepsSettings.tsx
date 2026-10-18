import { useEffect, useState } from 'react'
import { DEFAULT_STEPS_GOAL, Steps } from '../../native/steps'
import { Button } from '../Button'
import { Card, SectionLabel } from '../Screen'
import { Stepper } from '../Stepper'
import styles from './Steps.module.css'

const pad = (n: number) => String(n).padStart(2, '0')

/** «Настройки» → «Шаги» (Android-версия): цель и вечернее уведомление с итогом. */
export function StepsSettings() {
  const [goal, setGoal] = useState(DEFAULT_STEPS_GOAL)
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('21:00')
  const [background, setBackground] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void Steps.status()
      .then((s) => {
        if (s.goal) setGoal(s.goal)
        setEnabled(!!s.reminder)
        if (s.hour !== undefined) setTime(`${pad(s.hour)}:${pad(s.minute ?? 0)}`)
        setBackground(s.background || s.backgroundSupported === false)
      })
      .catch(() => {})
  }, [])

  async function save(next: { enabled?: boolean; goal?: number; time?: string }) {
    const e = next.enabled ?? enabled
    const g = next.goal ?? goal
    const [h, m] = (next.time ?? time).split(':').map(Number)
    setMessage(null)
    try {
      await Steps.setReminder({ enabled: e, hour: h, minute: m, goal: g })
      setEnabled(e)
      if (e && !background) {
        await Steps.requestAccess().catch(() => null)
        const s = await Steps.status()
        setBackground(s.background || s.backgroundSupported === false)
      }
      setMessage(e ? `Уведомление каждый день в ${next.time ?? time}` : 'Уведомление выключено')
    } catch (err) {
      setEnabled(false)
      setMessage(err instanceof Error ? err.message : 'Не удалось сохранить')
    }
  }

  return (
    <>
      <SectionLabel>Шаги</SectionLabel>
      <Card>
        <div className={styles.settings}>
          <label className={styles.setting}>
            <span>Цель на день</span>
            <Stepper
              label="Цель шагов на день"
              value={goal}
              step={500}
              min={0}
              max={100000}
              onChange={(v) => {
                setGoal(v)
                void save({ goal: v })
              }}
            />
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => void save({ enabled: e.target.checked })}
            />
            Вечером присылать итог шагов
          </label>
          {enabled && (
            <label className={styles.setting}>
              <span>Время уведомления</span>
              <input
                type="time"
                className={styles.time}
                value={time}
                onChange={(e) => {
                  setTime(e.target.value)
                  if (e.target.value) void save({ time: e.target.value })
                }}
              />
            </label>
          )}
          {enabled && !background && (
            <p className={styles.error}>
              Для уведомления нужно разрешение Health Connect «Читать данные в фоне».
            </p>
          )}
          {message && (
            <p className={styles.muted} role="status">
              {message}
            </p>
          )}
          <Button
            size="sm"
            onClick={() =>
              Steps.testReminder().catch(() => setMessage('Сначала разрешите доступ к шагам'))
            }
          >
            Показать уведомление сейчас
          </Button>
        </div>
      </Card>
    </>
  )
}
