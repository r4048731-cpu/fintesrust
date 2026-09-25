import { useLiveQuery } from 'dexie-react-hooks'
import { useRepos } from '../app/dataContext'
import { EmptyState } from '../components/EmptyState'
import { Screen } from '../components/Screen'

export function HistoryScreen() {
  const repos = useRepos()
  const workouts = useLiveQuery(() => repos.workouts.listDone(), [repos])

  return (
    <Screen title="История">
      {workouts?.length === 0 && (
        <EmptyState title="Тренировок пока нет">
          <p>Завершённые тренировки появятся здесь: дата, длительность, тоннаж и все подходы.</p>
        </EmptyState>
      )}
      {workouts && workouts.length > 0 && <p>Тренировок: {workouts.length}</p>}
    </Screen>
  )
}
