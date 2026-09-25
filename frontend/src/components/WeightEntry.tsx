import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import {
  BODY_WEIGHT_LIMITS,
  correctedWeight,
  LATER_CORRECTION_KG,
} from '../data/repositories/bodyWeights'
import { toISODate } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import type { WeighTime } from '../domain/types'
import { Button } from './Button'
import { Segmented } from './Segmented'
import { Stepper } from './Stepper'
import styles from './WeightEntry.module.css'

const DEFAULT_KG = 70
const kg = (v: number) => `${formatDecimal(v)} кг`
const TIME_OPTIONS: { value: WeighTime; label: string }[] = [
  { value: 'morning', label: 'Утром' },
  { value: 'later', label: 'Днём / вечером' },
]

/**
 * Запись сегодняшнего веса (ТЗ 9.2): время взвешивания, вес на весах и итог с поправкой.
 * Одна и та же на экране «Сегодня» и во вкладке «Вес».
 */
export function WeightEntry({ title }: { title?: string }) {
  const repos = useRepos()
  const last = useLiveQuery(async () => {
    const rows = await repos.bodyWeights.list()
    return rows[rows.length - 1] ?? null
  }, [repos])
  const [measured, setMeasured] = useState<number | null>(null)
  const [time, setTime] = useState<WeighTime>('morning')
  const [error, setError] = useState<string | null>(null)
  if (last === undefined) return null

  const todays = last?.date === toISODate(new Date()) ? last : null
  const value = measured ?? last?.measuredKg ?? last?.weightKg ?? DEFAULT_KG
  const result = correctedWeight(value, time)

  async function save() {
    setError(null)
    try {
      await repos.bodyWeights.record(value, time)
      setMeasured(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    }
  }

  return (
    <section className={styles.entry} aria-label={title ?? 'Записать вес'}>
      {title && (
        <div className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          {todays && <span className={styles.saved}>записано: {kg(todays.weightKg)}</span>}
        </div>
      )}
      <Segmented
        label="Когда взвешивались"
        options={TIME_OPTIONS}
        value={time}
        onChange={setTime}
      />
      <div className={styles.row}>
        <Stepper
          label="Вес на весах, кг"
          value={value}
          step={0.1}
          min={BODY_WEIGHT_LIMITS.min}
          max={BODY_WEIGHT_LIMITS.max}
          decimal
          onChange={setMeasured}
        />
        <Button variant="primary" onClick={save}>
          {todays ? 'Обновить' : 'Записать'}
        </Button>
      </div>
      <p className={styles.result} role="status">
        {time === 'later'
          ? `Запишется ${kg(result)} (−${formatDecimal(LATER_CORRECTION_KG)} кг)`
          : `Запишется ${kg(result)}`}
        {todays && ' — заменит сегодняшнюю запись'}
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  )
}
