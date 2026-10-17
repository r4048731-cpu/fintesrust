import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { LineChart } from '../components/charts/LineChart'
import { Card, SectionLabel } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { WeightEntry } from '../components/WeightEntry'
import { bodyWeightChange, LATER_CORRECTION_KG, weightDays } from '../data/repositories/bodyWeights'
import { parseISODate, toISODate } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import type { BodyWeight } from '../domain/types'
import styles from './WeightPanel.module.css'

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
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const shortDate = (iso: string) => {
  const d = parseISODate(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}
const kg = (v: number) => `${formatDecimal(v)} кг`

/** «−0,5 кг», «+0,3 кг», «0 кг». */
function signed(v: number): string {
  if (v === 0) return '0 кг'
  return `${v > 0 ? '+' : '−'}${formatDecimal(Math.abs(v))} кг`
}

/** «похудел на 0,5 кг» — для экранного диктора. */
function spoken(v: number): string {
  if (v === 0) return 'без изменений'
  return `${v < 0 ? 'похудел' : 'набрал'} на ${formatDecimal(Math.abs(v))} кг`
}

function measured(r: BodyWeight): string {
  return r.timeOfDay === 'later'
    ? `весы ${kg(r.measuredKg ?? r.weightKg + LATER_CORRECTION_KG)}`
    : 'утром'
}

/** Вес в разделе «Прогресс» → «Вес тела» (ТЗ 9.2): запись, итоги, график и список по дням с разницей между ними. */
export function WeightPanel() {
  const repos = useRepos()
  const rows = useLiveQuery(() => repos.bodyWeights.list(), [repos])
  const [editingId, setEditingId] = useState<string | null>(null)
  if (!rows) return null
  const editing = rows.find((r) => r.id === editingId)

  const today = toISODate(new Date())
  const first = rows[0]
  const last = rows[rows.length - 1]
  const change30 = bodyWeightChange(rows, 30, today)
  const total = rows.length >= 2 ? Math.round((last.weightKg - first.weightKg) * 10) / 10 : null

  return (
    <>
      <WeightEntry title="Вес сегодня" />

      {last && (
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.label}>Сейчас</span>
            <span className={styles.value}>{kg(last.weightKg)}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.label}>За 30 дней</span>
            <span className={`${styles.value} ${change30 !== null ? diffClass(change30) : ''}`}>
              {change30 !== null ? signed(change30) : '—'}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.label}>С {shortDate(first.date)}</span>
            <span className={`${styles.value} ${total !== null ? diffClass(total) : ''}`}>
              {total !== null ? signed(total) : '—'}
            </span>
          </div>
        </div>
      )}

      {rows.length >= 2 && (
        <Card>
          <h2 className={styles.cardTitle}>Итоговый вес, кг</h2>
          <LineChart
            points={rows.map((r) => ({ label: shortDate(r.date), values: { kg: r.weightKg } }))}
            series={[{ key: 'kg', name: 'Вес', color: 'var(--chart-1)' }]}
            format={(v) => formatDecimal(Math.round(v * 10) / 10)}
            ariaLabel={`Вес тела по ${rows.length} записям, последний ${kg(last.weightKg)}`}
          />
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <SectionLabel>По дням</SectionLabel>
          <ul className={styles.list} aria-label="Вес по дням">
            {weightDays(rows).map(({ row, diffKg }) => {
              const d = parseISODate(row.date)
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => setEditingId(row.id)}
                    aria-label={`${shortDate(row.date)}, ${kg(row.weightKg)} — изменить`}
                  >
                    <span className={styles.date}>
                      <b>{shortDate(row.date)}</b>
                      <span>{WEEKDAYS[d.getDay()]}</span>
                    </span>
                    <span className={styles.weight}>
                      <b>{kg(row.weightKg)}</b>
                      <span
                        title={row.timeOfDay === 'later' ? 'Днём или вечером, −1,5 кг' : undefined}
                      >
                        {measured(row)}
                      </span>
                    </span>
                    <span
                      className={`${styles.diff} ${diffKg !== null ? diffClass(diffKg) : ''}`}
                      aria-label={diffKg !== null ? spoken(diffKg) : 'первая запись'}
                    >
                      {diffKg !== null ? signed(diffKg) : '—'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Sheet
        open={!!editing}
        onClose={() => setEditingId(null)}
        title={editing ? `Вес за ${shortDate(editing.date)}` : ''}
        footer={
          editing && (
            <Button
              variant="danger"
              block
              onClick={async () => {
                setEditingId(null)
                await repos.bodyWeights.remove(editing.id)
              }}
            >
              Удалить запись
            </Button>
          )
        }
      >
        {editing && (
          <WeightEntry key={editing.id} row={editing} onSaved={() => setEditingId(null)} />
        )}
      </Sheet>
    </>
  )
}

function diffClass(v: number): string {
  return v < 0 ? styles.down : v > 0 ? styles.up : styles.same
}
