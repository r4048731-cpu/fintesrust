import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useRepos } from '../app/dataContext'
import { formatRecordValue, RECORD_LABELS } from '../domain/metrics'
import { monthSummary, monthTitle, shiftMonth, yearMonth, type YearMonth } from '../domain/month'
import { formatDecimal, formatInteger } from '../domain/number'
import { plural } from '../domain/plural'
import type { Workout } from '../domain/types'
import { shareImage } from '../native/shareImage'
import { Button, IconButton } from './Button'
import { Icon } from './Icon'
import { deltaText, formatHoursShort, formatTonnage, renderMonthImage } from './monthImage'
import { Card } from './Screen'
import styles from './MonthSummaryCard.module.css'

/** Сколько рекордов показать в карточке; на картинке — до четырёх. */
const SHOWN_RECORDS = 3

/** «Прогресс» → «История»: итоги месяца с переключением месяцев и картинкой «Поделиться». */
export function MonthSummaryCard({ workouts }: { workouts: Workout[] }) {
  const repos = useRepos()
  const current = yearMonth(new Date())
  const [month, setMonth] = useState<YearMonth>(current)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const exercises = useLiveQuery(() => repos.exercises.list(), [repos])
  const runs = useLiveQuery(() => repos.runs.list(), [repos])
  const first = workouts.reduce((m, w) => (w.date < m ? w.date : m), current).slice(0, 7)

  const byId = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  const summary = useMemo(
    () =>
      exercises && runs
        ? monthSummary(workouts, runs, month, (id) => byId.get(id)?.type ?? 'weight')
        : null,
    [workouts, runs, month, byId, exercises],
  )
  if (!summary) return null
  const nameOf = (id: string) => byId.get(id)?.name ?? 'Упражнение'
  const prev = shiftMonth(month, -1)
  const ongoing = month === current
  const delta = deltaText(summary, prev, ongoing)

  async function share() {
    if (!summary) return
    setBusy(true)
    setNote(null)
    try {
      const blob = await renderMonthImage(summary, prev, nameOf, ongoing)
      const result = await shareImage(blob, `fitnes-${summary.month}.png`, 'Итоги месяца')
      if (result === 'downloaded') setNote('Картинка сохранена в загрузки')
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Не удалось поделиться')
    } finally {
      setBusy(false)
    }
  }

  const tiles = [
    { label: 'Тоннаж', value: formatTonnage(summary.tonnageKg) },
    { label: 'Подходы', value: formatInteger(summary.sets) },
    { label: 'Время', value: formatHoursShort(summary.minutes) },
  ]

  return (
    <Card framed className={styles.card}>
      <div className={styles.head}>
        <IconButton
          icon="back"
          label="Прошлый месяц"
          size="sm"
          disabled={month <= first}
          onClick={() => setMonth(shiftMonth(month, -1))}
        />
        <div className={styles.title}>
          <span className={styles.eyebrow}>Итоги месяца</span>
          <h2 aria-live="polite">{monthTitle(month)}</h2>
        </div>
        <IconButton
          icon="chevron"
          label="Следующий месяц"
          size="sm"
          disabled={month >= current}
          onClick={() => setMonth(shiftMonth(month, 1))}
        />
      </div>

      {summary.workouts === 0 ? (
        <p className={styles.muted}>
          {month === current
            ? 'В этом месяце тренировок пока нет.'
            : 'В этом месяце тренировок не было.'}
        </p>
      ) : (
        <>
          <div className={styles.hero}>
            <b className={styles.big}>{summary.workouts}</b>
            <span>
              <span className={styles.heroLabel}>
                {plural(summary.workouts, 'тренировка', 'тренировки', 'тренировок')}
              </span>
              <span className={styles.muted}>
                {summary.days} {plural(summary.days, 'день', 'дня', 'дней')} в зале
                {delta && (
                  <>
                    {' · '}
                    <span className={summary.workouts > summary.prevWorkouts ? styles.up : ''}>
                      {delta}
                    </span>
                  </>
                )}
              </span>
            </span>
          </div>

          <div className={styles.tiles}>
            {tiles.map((t) => (
              <div key={t.label} className={styles.tile}>
                <span>{t.label}</span>
                <b>{t.value}</b>
              </div>
            ))}
          </div>

          {summary.records.length > 0 && (
            <ul className={styles.records} aria-label="Рекорды месяца">
              {summary.records.slice(0, SHOWN_RECORDS).map((r) => (
                <li key={r.exerciseId}>
                  <span className={styles.cup} aria-hidden="true">
                    <Icon name="trophy" size={16} />
                  </span>
                  <span className={styles.recText}>
                    <b>{nameOf(r.exerciseId)}</b>
                    <span>{RECORD_LABELS[r.kind]}</span>
                  </span>
                  <span className={styles.recValue}>
                    <b>{formatRecordValue(r.kind, r.value)}</b>
                    <span>было {formatRecordValue(r.kind, r.previous)}</span>
                  </span>
                </li>
              ))}
              {summary.records.length > SHOWN_RECORDS && (
                <li className={styles.more}>
                  и ещё {summary.records.length - SHOWN_RECORDS}{' '}
                  {plural(summary.records.length - SHOWN_RECORDS, 'рекорд', 'рекорда', 'рекордов')}
                </li>
              )}
            </ul>
          )}

          {(summary.top || summary.runs > 0) && (
            <p className={styles.facts}>
              {summary.top && (
                <span>
                  Чаще всего: <b>{nameOf(summary.top.exerciseId)}</b> — {summary.top.sets}{' '}
                  {plural(summary.top.sets, 'подход', 'подхода', 'подходов')}
                </span>
              )}
              {summary.runs > 0 && (
                <span>
                  Бег и ходьба: <b>{formatDecimal(Math.round(summary.runKm * 10) / 10)} км</b>
                </span>
              )}
            </p>
          )}

          <Button block icon="share" onClick={() => void share()} disabled={busy}>
            {busy ? 'Рисую картинку…' : 'Поделиться картинкой'}
          </Button>
          {note && (
            <p className={styles.muted} role="status">
              {note}
            </p>
          )}
        </>
      )}
    </Card>
  )
}
