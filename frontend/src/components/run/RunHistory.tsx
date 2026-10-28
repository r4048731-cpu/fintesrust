import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { useRepos } from '../../app/dataContext'
import { formatKm, formatPace, paceSecPerKm, runCalories, runTotals } from '../../domain/run'
import { formatClock } from '../../domain/workout'
import { EmptyState } from '../EmptyState'
import { RouteSketch } from './RouteSketch'
import { CountUp } from '../fx/CountUp'
import styles from './Run.module.css'

const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })

/** Итоги и лента пробежек: «Бег и ходьба» и «Прогресс» → «История». */
export function RunHistory({ limit, hideEmpty }: { limit?: number; hideEmpty?: boolean }) {
  const repos = useRepos()
  const navigate = useNavigate()
  const runs = useLiveQuery(() => repos.runs.list(), [repos])
  if (!runs) return null
  if (runs.length === 0) {
    if (hideEmpty) return null
    return (
      <EmptyState title="Пробежек пока нет" icon="run">
        <p>Нажмите «Старт» — приложение запишет маршрут, километры и темп по GPS.</p>
      </EmptyState>
    )
  }
  const t = runTotals(runs)
  const shown = limit ? runs.slice(0, limit) : runs
  return (
    <>
      <div className={styles.totals} role="group" aria-label="Итоги">
        <div className={styles.total}>
          <b>
            <CountUp value={t.distanceM} format={formatKm} />
          </b>
          <span>км всего</span>
        </div>
        <div className={styles.total}>
          <b>{formatClock(t.movingMs / 1000)}</b>
          <span>в движении</span>
        </div>
        <div className={styles.total}>
          <b>
            <CountUp value={t.calories} format={(v) => String(Math.round(v))} />
          </b>
          <span>ккал</span>
        </div>
        <div className={styles.total}>
          <b>{formatPace(t.bestKmSec)}</b>
          <span>лучший км</span>
        </div>
      </div>
      <ul className={styles.list} aria-label="Пробежки">
        {shown.map((r) => (
          <li key={r.id}>
            <button type="button" className={styles.row} onClick={() => navigate(`/run/${r.id}`)}>
              <RouteSketch segments={r.segments} />
              <span className={styles.rowText}>
                <span className={styles.rowHead}>
                  <b>{formatKm(r.distanceM)} км</b>
                  <span>
                    {r.kind === 'run' ? 'бег' : 'ходьба'} · {dateFormat.format(r.startedAt)}
                  </span>
                </span>
                <span className={styles.rowMeta}>
                  {formatClock(r.movingMs / 1000)} ·{' '}
                  {formatPace(paceSecPerKm(r.distanceM, r.movingMs))} мин/км ·{' '}
                  {runCalories(r.kind, r.distanceM, r.bodyKg)} ккал
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
