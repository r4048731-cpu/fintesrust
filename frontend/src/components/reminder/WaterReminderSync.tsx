import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { useRepos } from '../../app/dataContext'
import { toISODate } from '../../domain/metrics'
import { waterGoalMl } from '../../domain/trackers'
import { setWaterInfo } from '../../native/water'

/**
 * Держит в телефоне, сколько воды выпито сегодня и какая норма, — по ним напоминание
 * решает, звать ли «стакан воды?». Ничего не рисует; подключается только в Android-версии.
 */
export function WaterReminderSync() {
  const repos = useRepos()
  const today = toISODate(new Date())
  const info = useLiveQuery(async () => {
    const [trackers, weights] = await Promise.all([
      repos.meta.get('dayTrackers'),
      repos.bodyWeights.list(),
    ])
    return {
      ml: trackers[today]?.waterMl ?? 0,
      goal: waterGoalMl(weights.at(-1)?.weightKg ?? null),
    }
  }, [repos, today])

  useEffect(() => {
    if (info) setWaterInfo(today, info.ml, info.goal)
  }, [info, today])

  return null
}
