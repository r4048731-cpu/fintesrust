import { useEffect, useState } from 'react'
import { Water, type WaterReminderSettings as Settings } from '../../native/water'
import { Button } from '../Button'
import { Card, SectionLabel } from '../Screen'
import { Segmented } from '../Segmented'
import steps from '../steps/Steps.module.css'

const pad = (n: number) => String(n).padStart(2, '0')
const DEFAULT: Settings = { enabled: false, from: 9, to: 21, every: 2 }
const EVERY = [
  { value: '1', label: '1 ч' },
  { value: '2', label: '2 ч' },
  { value: '3', label: '3 ч' },
]

/** «Настройки» → «Вода» (Android-версия): напоминать пить, если до нормы далеко. */
export function WaterReminderSettings() {
  const [state, setState] = useState<Settings>(DEFAULT)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void Water.getReminder()
      .then(setState)
      .catch(() => {})
  }, [])

  async function save(patch: Partial<Settings>) {
    const next = { ...state, ...patch }
    if (next.to <= next.from) return setMessage('Конец — позже начала')
    setMessage(null)
    try {
      await Water.setReminder(next)
      setState(next)
      setMessage(
        next.enabled
          ? `Проверю с ${pad(next.from)}:00 до ${pad(next.to)}:00 каждые ${next.every} ч`
          : 'Напоминание выключено',
      )
    } catch (err) {
      setState({ ...next, enabled: false })
      setMessage(err instanceof Error ? err.message : 'Не удалось сохранить — обновите приложение')
    }
  }

  const hour = (label: string, value: number, key: 'from' | 'to') => (
    <label className={steps.setting}>
      <span>{label}</span>
      <input
        type="time"
        step={3600}
        className={steps.time}
        value={`${pad(value)}:00`}
        onChange={(e) => {
          if (!e.target.value) return
          void save({ [key]: Number(e.target.value.split(':')[0]) })
        }}
      />
    </label>
  )

  return (
    <>
      <SectionLabel>Вода</SectionLabel>
      <Card>
        <div className={steps.settings}>
          <label className={steps.toggle}>
            <input
              type="checkbox"
              checked={state.enabled}
              onChange={(e) => void save({ enabled: e.target.checked })}
            />
            Напоминать пить воду
          </label>
          {state.enabled && (
            <>
              {hour('С', state.from, 'from')}
              {hour('До', state.to, 'to')}
              <Segmented
                label="Как часто"
                options={EVERY}
                value={String(state.every)}
                onChange={(v) => void save({ every: Number(v) })}
              />
              <p className={steps.muted}>
                Уведомление придёт, только если выпито меньше, чем нужно к этому часу, — норма
                делится ровно на день. Выпили норму — напоминаний больше не будет.
              </p>
            </>
          )}
          {message && (
            <p className={steps.muted} role="status">
              {message}
            </p>
          )}
          <Button size="sm" onClick={() => void Water.testReminder().catch(() => {})}>
            Показать уведомление сейчас
          </Button>
        </div>
      </Card>
    </>
  )
}
