import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Card, Screen, SectionLabel } from '../components/Screen'
import { Stepper } from '../components/Stepper'
import { formatLongDate } from '../components/dates'

export function TodayScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const next = useLiveQuery(async () => {
    const program = await repos.programs.getActive()
    if (!program) return null
    return { program, next: await repos.programs.nextDay(program.id) }
  }, [repos])
  const weightStep = useLiveQuery(() => repos.meta.get('weightStepKg'), [repos])

  return (
    <Screen title="Сегодня" eyebrow={formatLongDate(new Date())}>
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
          <h2>{next.next.day.name}</h2>
          <Button variant="primary" block disabled>
            Начать тренировку (скоро)
          </Button>
        </Card>
      )}

      <SectionLabel>Настройки</SectionLabel>
      <Card>
        <label htmlFor="weight-step">Шаг веса для кнопок ±, кг</label>
        {weightStep !== undefined && (
          <Stepper
            id="weight-step"
            label="Шаг веса, кг"
            value={weightStep}
            step={0.25}
            min={0.25}
            max={10}
            decimal
            onChange={(v) => repos.meta.set('weightStepKg', v)}
          />
        )}
      </Card>
    </Screen>
  )
}
