import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { useRepos } from '../../app/dataContext'
import { lastDoneDate, reminderTitle } from '../../domain/reminder'
import { setTrainingInfo } from '../../native/workoutAlerts'

/**
 * Держит в телефоне текст напоминания: какой день программы следующий и когда была
 * последняя тренировка. Ничего не рисует; подключается только в Android-версии.
 */
export function TrainingReminderSync() {
  const repos = useRepos()
  const info = useLiveQuery(async () => {
    const program = await repos.programs.getActive()
    const next = program ? await repos.programs.nextDay(program.id) : null
    return {
      next: reminderTitle(next?.day ?? null),
      doneDate: lastDoneDate(await repos.workouts.listDone()),
    }
  }, [repos])

  useEffect(() => {
    if (info) setTrainingInfo(info.next, info.doneDate)
  }, [info])

  return null
}
