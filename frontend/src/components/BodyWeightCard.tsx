import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import { BODY_WEIGHT_LIMITS, bodyWeightChange } from '../data/repositories/bodyWeights'
import { parseISODate, toISODate } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import { Button, IconButton } from './Button'
import { LineChart } from './charts/LineChart'
import { Card } from './Screen'
import { Stepper } from './Stepper'
import styles from './BodyWeightCard.module.css'

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]
const shortDate = (iso: string) => {
  const d = parseISODate(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}
const DEFAULT_KG = 70
const RECENT = 5

/** Вес тела (ТЗ 2.5, п. 4): запись за сегодня, изменение за месяц, график. */
export function BodyWeightCard() {
  const repos = useRepos()
  const rows = useLiveQuery(() => repos.bodyWeights.list(), [repos])
  const [draft, setDraft] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!rows) return null

  const today = toISODate(new Date())
  const last = rows[rows.length - 1]
  const todays = last?.date === today ? last : null
  const value = draft ?? last?.weightKg ?? DEFAULT_KG
  const change = bodyWeightChange(rows, 30, today)

  async function save() {
    setError(null)
    try {
      await repos.bodyWeights.record(value)
      setDraft(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    }
  }

  return (
    <Card>
      <div className={styles.head}>
        <h2 className={styles.title}>Вес тела</h2>
        {last && (
          <span className={styles.current}>
            {formatDecimal(last.weightKg)} кг
            {change !== null && (
              <span className={styles.change}>
                {' '}
                {change > 0 ? '+' : change < 0 ? '−' : '±'}
                {formatDecimal(Math.abs(change))} за 30 дней
              </span>
            )}
          </span>
        )}
      </div>

      <div className={styles.entry}>
        <Stepper
          label="Вес тела, кг"
          value={value}
          step={0.1}
          min={BODY_WEIGHT_LIMITS.min}
          max={BODY_WEIGHT_LIMITS.max}
          decimal
          onChange={setDraft}
        />
        <Button variant="primary" onClick={save}>
          {todays ? 'Обновить' : 'Записать'}
        </Button>
      </div>
      <p className={styles.hint}>
        {todays
          ? `Сегодня записано ${formatDecimal(todays.weightKg)} кг. Новая запись заменит её.`
          : 'Лучше взвешиваться в одно время, например утром.'}
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {rows.length >= 2 && (
        <LineChart
          points={rows.map((r) => ({ label: shortDate(r.date), values: { kg: r.weightKg } }))}
          series={[{ key: 'kg', name: 'Вес тела', color: 'var(--chart-1)' }]}
          format={(v) => formatDecimal(Math.round(v * 10) / 10)}
          ariaLabel={`Вес тела по ${rows.length} записям, последний ${formatDecimal(last.weightKg)} кг`}
        />
      )}

      {rows.length > 0 && (
        <ul className={styles.list} aria-label="Последние записи веса">
          {[...rows]
            .reverse()
            .slice(0, RECENT)
            .map((r) => (
              <li key={r.id}>
                <span>{shortDate(r.date)}</span>
                <span className={styles.kg}>{formatDecimal(r.weightKg)} кг</span>
                <IconButton
                  icon="close"
                  size="sm"
                  label={`Удалить запись за ${shortDate(r.date)}`}
                  onClick={() => repos.bodyWeights.remove(r.id)}
                />
              </li>
            ))}
        </ul>
      )}
    </Card>
  )
}
