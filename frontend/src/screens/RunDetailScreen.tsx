import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { RouteMap } from '../components/run/RouteMap'
import { Card, Screen, SectionLabel } from '../components/Screen'
import { formatLongDate } from '../components/dates'
import { formatDecimal } from '../domain/number'
import { formatKm, formatPace, paceSecPerKm, runCalories, splits } from '../domain/run'
import { formatClock } from '../domain/workout'
import styles from './RunDetailScreen.module.css'

/** Детали пробежки: карта, итоги, темп по километрам. */
export function RunDetailScreen() {
  const { runId = '' } = useParams()
  const repos = useRepos()
  const navigate = useNavigate()
  const run = useLiveQuery(async () => (await repos.runs.get(runId)) ?? null, [repos, runId])
  const [confirm, setConfirm] = useState(false)
  if (run === undefined) return null
  if (run === null) {
    return (
      <Screen title="Пробежка" onBack={() => navigate('/run')}>
        <p>Пробежка не найдена.</p>
      </Screen>
    )
  }

  const pace = paceSecPerKm(run.distanceM, run.movingMs)
  const speed = run.movingMs > 0 ? run.distanceM / 1000 / (run.movingMs / 3600000) : 0
  const kms = splits(run.segments)
  const best = kms.length ? Math.min(...kms) : null
  const worst = kms.length ? Math.max(...kms) : null

  return (
    <Screen
      title={run.kind === 'run' ? 'Пробежка' : 'Прогулка'}
      eyebrow={formatLongDate(new Date(run.startedAt))}
      onBack={() => navigate('/run')}
    >
      <RouteMap segments={run.segments} height={260} />

      <div className={styles.main}>
        <div>
          <b>{formatKm(run.distanceM)}</b>
          <span>км</span>
        </div>
        <div>
          <b>{formatClock(run.movingMs / 1000)}</b>
          <span>время</span>
        </div>
        <div>
          <b>{formatPace(pace)}</b>
          <span>темп, мин/км</span>
        </div>
      </div>

      <Card>
        <dl className={styles.facts}>
          <dt>Средняя скорость</dt>
          <dd>{formatDecimal(Math.round(speed * 10) / 10)} км/ч</dd>
          <dt>Калории</dt>
          <dd>{runCalories(run.kind, run.distanceM, run.bodyKg)} ккал</dd>
          <dt>Набор высоты</dt>
          <dd>{run.climbM} м</dd>
          {best !== null && (
            <>
              <dt>Лучший километр</dt>
              <dd>{formatPace(best)}</dd>
            </>
          )}
        </dl>
      </Card>

      {kms.length > 0 && (
        <>
          <SectionLabel>Темп по километрам</SectionLabel>
          <Card>
            <ol className={styles.splits} aria-label="Темп по километрам">
              {kms.map((sec, i) => (
                <li key={i}>
                  <span className={styles.km}>{i + 1} км</span>
                  <span className={styles.bar}>
                    <span
                      className={sec === best ? styles.best : undefined}
                      // быстрый километр — длинная полоска
                      style={{ width: `${Math.max(12, (best! / sec) * 100)}%` }}
                    />
                  </span>
                  <span className={styles.pace}>{formatPace(sec)}</span>
                </li>
              ))}
            </ol>
            {worst !== null && best !== null && worst - best > 15 && (
              <p className={styles.note}>
                Разброс {Math.round(worst - best)} с на километр — держите ровный темп.
              </p>
            )}
          </Card>
        </>
      )}

      {confirm ? (
        <div className={styles.confirm} role="alertdialog" aria-label="Удаление пробежки">
          <p>Удалить пробежку?</p>
          <div className={styles.actions}>
            <Button
              variant="danger"
              onClick={async () => {
                await repos.runs.remove(run.id)
                navigate('/run', { replace: true })
              }}
            >
              Удалить
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className={styles.danger} onClick={() => setConfirm(true)}>
          Удалить пробежку
        </Button>
      )}
    </Screen>
  )
}
