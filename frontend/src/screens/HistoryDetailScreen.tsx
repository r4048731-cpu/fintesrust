import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Screen } from '../components/Screen'
import { useWorkoutReport } from '../components/useWorkoutReport'
import { WorkoutReport } from '../components/WorkoutReport'
import { formatLongDate } from '../components/dates'
import { parseISODate } from '../domain/metrics'
import styles from './HistoryDetailScreen.module.css'

/** Прошедшая тренировка (ТЗ 2.4): просмотр, правка, удаление. */
export function HistoryDetailScreen() {
  const { workoutId = '' } = useParams()
  const repos = useRepos()
  const navigate = useNavigate()
  const data = useWorkoutReport(repos, workoutId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [repeatError, setRepeatError] = useState<string | null>(null)
  const hasActive = useLiveQuery(async () => (await repos.workouts.getActive()) !== null, [repos])

  if (data === undefined) return null
  if (data === null) {
    return (
      <Screen title="Тренировка" onBack={() => navigate('/progress')}>
        <EmptyState title="Тренировка не найдена">
          <p>Возможно, её удалили.</p>
        </EmptyState>
      </Screen>
    )
  }

  const { workout } = data
  const date = parseISODate(workout.date)

  return (
    <Screen
      title={workout.name}
      eyebrow={`${formatLongDate(date)} ${date.getFullYear()}`}
      onBack={() => navigate('/progress')}
      action={
        <Button size="sm" onClick={() => navigate(`/history/${workout.id}/edit`)}>
          Изменить
        </Button>
      }
    >
      <WorkoutReport data={data} />

      <Button
        variant="primary"
        block
        disabled={hasActive !== false}
        onClick={async () => {
          try {
            await repos.workouts.repeat(workout.id)
            navigate('/workout')
          } catch {
            setRepeatError('Не удалось начать тренировку. Попробуйте ещё раз.')
          }
        }}
      >
        Повторить тренировку
      </Button>
      {hasActive && (
        <p className={styles.note}>Сейчас идёт другая тренировка — сначала завершите её.</p>
      )}
      {repeatError && (
        <p role="alert" className={styles.note}>
          {repeatError}
        </p>
      )}

      {confirmDelete ? (
        <div className={styles.confirm} role="alertdialog" aria-label="Подтверждение удаления">
          <p>Удалить тренировку?</p>
          <div className={styles.actions}>
            <Button
              variant="danger"
              onClick={async () => {
                await repos.workouts.remove(workout.id)
                navigate('/progress', { replace: true })
              }}
            >
              Удалить
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="danger" block onClick={() => setConfirmDelete(true)}>
          Удалить тренировку
        </Button>
      )}
    </Screen>
  )
}
