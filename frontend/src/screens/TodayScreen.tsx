import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { useNow } from '../app/hooks/useNow'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Card, Screen, SectionLabel } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { formatLongDate } from '../components/dates'
import { ActiveWorkoutExistsError } from '../data'
import { backupIsDue } from '../data/backup'
import { activitySummary } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import { formatPlan } from '../domain/programs'
import { countSets, formatClock } from '../domain/workout'
import styles from './TodayScreen.module.css'

export function TodayScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const active = useLiveQuery(() => repos.workouts.getActive(), [repos])
  const now = useNow(1000, !!active)
  const next = useLiveQuery(async () => {
    const program = await repos.programs.getActive()
    if (!program) return null
    const next = await repos.programs.nextDay(program.id)
    const items = await Promise.all(
      (next?.day.items ?? []).map(async (item) => ({
        item,
        exercise: await repos.exercises.get(item.exerciseId),
      })),
    )
    return { program, next, items }
  }, [repos])
  const programs = useLiveQuery(() => repos.programs.list(), [repos])
  const summary = useLiveQuery(
    async () => activitySummary(await repos.workouts.listDone(), new Date()),
    [repos],
  )
  const backupDue = useLiveQuery(
    async () =>
      backupIsDue(
        await repos.meta.get('lastExportAt'),
        (await repos.workouts.listDone()).length,
        Date.now(),
      ),
    [repos],
  )

  async function start(from: { programId: string; dayId: string } | null) {
    setError(null)
    try {
      await repos.workouts.start(from)
      navigate('/workout')
    } catch (err) {
      if (err instanceof ActiveWorkoutExistsError) navigate('/workout')
      else setError('Не удалось начать тренировку. Попробуйте ещё раз.')
    }
  }

  return (
    <Screen title="Сегодня" eyebrow={formatLongDate(new Date())}>
      {active && (
        <button type="button" className={styles.live} onClick={() => navigate('/workout')}>
          <span className={styles.liveText}>
            <span className={styles.liveLabel}>Тренировка идёт</span>
            <span className={styles.liveName}>{active.name}</span>
            <span className={styles.liveMeta}>
              {countSets(active).done} из {countSets(active).total} подходов
            </span>
          </span>
          <span className={styles.liveClock}>{formatClock((now - active.startedAt) / 1000)}</span>
          <Icon name="chevron" />
        </button>
      )}

      {next === null && (
        <EmptyState
          title="Составьте первую программу"
          action={
            <Button variant="primary" onClick={() => navigate('/programs')}>
              Перейти к программам
            </Button>
          }
        >
          <p>
            Программа — это дни тренировок с упражнениями, подходами, повторениями и весом.
            Приложение будет предлагать следующий день по кругу.
          </p>
        </EmptyState>
      )}

      {next?.next && (
        <Card>
          <SectionLabel>Следующая · {next.program.name}</SectionLabel>
          <h2 className={styles.dayName}>{next.next.day.name}</h2>
          {next.items.length > 0 ? (
            <ol className={styles.plan}>
              {next.items.map(({ item, exercise }, i) => (
                <li key={i}>
                  <span>{exercise?.name ?? 'Упражнение не найдено'}</span>
                  <span className={styles.planText}>
                    {formatPlan(item, exercise?.type ?? 'weight')}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.planEmpty}>
              В этом дне пока нет упражнений: их можно добавить в программе или прямо в тренировке.
            </p>
          )}
          {!active && (
            <Button
              variant="primary"
              block
              onClick={() => start({ programId: next.program.id, dayId: next.next!.day.id })}
            >
              Начать тренировку
            </Button>
          )}
          <div className={styles.row}>
            {!active && (
              <Button size="sm" onClick={() => setDayPickerOpen(true)}>
                Другой день
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(`/programs/${next.program.id}`)}
            >
              Изменить программу
            </Button>
          </div>
        </Card>
      )}

      {!active && next !== undefined && (
        <Button block onClick={() => start(null)}>
          Свободная тренировка без плана
        </Button>
      )}
      {backupDue && !active && (
        <button type="button" className={styles.reminder} onClick={() => navigate('/settings')}>
          <span className={styles.reminderTitle}>Сохраните резервную копию</span>
          <span className={styles.reminderText}>
            Данные хранятся только на этом телефоне. Копия в файле защитит их от потери.
          </span>
        </button>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {summary && summary.total > 0 && (
        <button type="button" className={styles.stats} onClick={() => navigate('/progress')}>
          <span className={styles.stat}>
            <span className={styles.statLabel}>За 7 дней</span>
            <span className={styles.statValue}>{summary.last7}</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Тоннаж</span>
            <span className={styles.statValue}>
              {formatDecimal(Math.round(summary.tonnage7Kg / 100) / 10)} <small>т</small>
            </span>
          </span>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Всего</span>
            <span className={styles.statValue}>{summary.total}</span>
          </span>
        </button>
      )}

      <Sheet open={dayPickerOpen} onClose={() => setDayPickerOpen(false)} title="Выбрать день">
        {programs?.map((p) => (
          <section key={p.id} className={styles.pickGroup} aria-label={p.name}>
            <SectionLabel>{p.name}</SectionLabel>
            <ul className={styles.pickList}>
              {p.days.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={styles.pickRow}
                    onClick={() => {
                      setDayPickerOpen(false)
                      void start({ programId: p.id, dayId: d.id })
                    }}
                  >
                    <span className={styles.pickName}>{d.name}</span>
                    <span className={styles.planText}>
                      {d.items.length ? `${d.items.length} упр.` : 'пустой день'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Sheet>
    </Screen>
  )
}
