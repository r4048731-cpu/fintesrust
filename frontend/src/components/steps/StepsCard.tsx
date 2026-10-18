import { useCallback, useEffect, useState } from 'react'
import { Steps, DEFAULT_STEPS_GOAL, type DaySteps, type StepsStatus } from '../../native/steps'
import { Button } from '../Button'
import frame from '../frame.module.css'
import styles from './Steps.module.css'

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const fmt = (n: number) => n.toLocaleString('ru-RU')

/**
 * Шаги за день на «Сегодня» (Android-версия): их весь день считает сам телефон,
 * приложение читает из Health Connect. Обновляется при каждом возвращении в приложение.
 */
export function StepsCard() {
  const [status, setStatus] = useState<StepsStatus | null>(null)
  const [days, setDays] = useState<DaySteps[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const st = await Steps.status()
      setStatus(st)
      if (st.health === 'available' && st.steps) setDays((await Steps.daily({ days: 7 })).days)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось прочитать шаги')
    }
  }, [])

  useEffect(() => {
    // первое чтение — после монтирования; дальше — при каждом возвращении в приложение
    const first = setTimeout(load, 0)
    const onShow = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      clearTimeout(first)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [load])

  if (!status) return null

  if (status.health !== 'available') {
    return (
      <section className={`${styles.card} ${frame.frame}`} aria-label="Шаги">
        <b>Шаги за день</b>
        <p className={styles.muted}>
          Шаги весь день считает сам телефон, а приложение берёт их из Health Connect.{' '}
          {status.health === 'update_required' ? 'Обновите' : 'Установите'} его — это бесплатно.
        </p>
        <Button size="sm" variant="primary" onClick={() => Steps.openHealthConnect()}>
          {status.health === 'update_required'
            ? 'Обновить Health Connect'
            : 'Установить Health Connect'}
        </Button>
      </section>
    )
  }

  if (!status.steps) {
    return (
      <section className={`${styles.card} ${frame.frame}`} aria-label="Шаги">
        <b>Шаги за день</b>
        <p className={styles.muted}>Разрешите приложению читать шаги из Health Connect.</p>
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            await Steps.requestAccess().catch(() => null)
            void load()
          }}
        >
          Разрешить доступ к шагам
        </Button>
      </section>
    )
  }

  const goal = status.goal ?? DEFAULT_STEPS_GOAL
  const today = days?.[days.length - 1]?.steps ?? 0
  const share = goal > 0 ? Math.min(1, today / goal) : 0
  const max = Math.max(goal, ...(days ?? []).map((d) => d.steps), 1)

  return (
    <section className={`${styles.card} ${frame.frame}`} aria-label="Шаги">
      <div className={styles.head}>
        <div>
          <span className={styles.label}>Шаги сегодня</span>
          <b className={styles.big}>{fmt(today)}</b>
          <span className={styles.muted}>
            {today >= goal ? 'цель выполнена' : `из ${fmt(goal)} · осталось ${fmt(goal - today)}`}
          </span>
        </div>
        <div
          className={styles.ring}
          style={{ ['--p' as string]: `${share * 360}deg` }}
          aria-hidden="true"
        >
          <span>{Math.round(share * 100)}%</span>
        </div>
      </div>
      {days && (
        <ol className={styles.week} aria-label="Шаги за неделю">
          {days.map((d) => {
            const wd = WEEKDAYS[new Date(`${d.date}T12:00`).getDay()]
            return (
              <li key={d.date} aria-label={`${wd}: ${fmt(d.steps)}`}>
                <span className={styles.barBox}>
                  <span
                    className={d.steps >= goal ? styles.barDone : styles.bar}
                    style={{ height: `${Math.max(4, (d.steps / max) * 100)}%` }}
                  />
                </span>
                <span className={styles.day}>{wd}</span>
              </li>
            )
          })}
        </ol>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}
