import { useNavigate, useParams } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Confetti } from '../components/fx/Confetti'
import { Screen } from '../components/Screen'
import { useWorkoutReport } from '../components/useWorkoutReport'
import { WorkoutReport } from '../components/WorkoutReport'

/** Сводка после «Завершить» (ТЗ 2.3, п. 7): время, тоннаж, рекорды. */
export function WorkoutSummaryScreen() {
  const { workoutId = '' } = useParams()
  const repos = useRepos()
  const navigate = useNavigate()
  const data = useWorkoutReport(repos, workoutId)

  if (data === undefined) return null
  if (data === null) {
    return (
      <Screen title="Тренировка" onBack={() => navigate('/')}>
        <EmptyState title="Тренировка не найдена" />
      </Screen>
    )
  }

  return (
    <Screen title="Готово!" eyebrow={data.workout.name}>
      <Confetti />
      <WorkoutReport data={data} />
      <Button icon="check" variant="primary" block onClick={() => navigate('/', { replace: true })}>
        Готово
      </Button>
    </Screen>
  )
}
