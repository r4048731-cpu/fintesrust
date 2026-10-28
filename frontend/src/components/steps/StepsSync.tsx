import { useEffect } from 'react'
import { useRepos } from '../../app/dataContext'
import { mergeSteps } from '../../domain/steps'
import { Steps } from '../../native/steps'

/** Сколько дней читать из Health Connect — больше он без особого разрешения не отдаёт. */
const READ_DAYS = 30

/**
 * Переносит шаги из Health Connect в базу приложения: при запуске и при каждом возвращении
 * в приложение. Так график шагов работает за любой период, а шаги попадают в резервную копию.
 * Ничего не рисует; подключается только в Android-версии.
 */
export function StepsSync() {
  const repos = useRepos()

  useEffect(() => {
    let busy = false
    async function sync() {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        const st = await Steps.status()
        if (st.health !== 'available' || !st.steps) return
        const { days } = await Steps.daily({ days: READ_DAYS })
        const next = mergeSteps(await repos.meta.get('stepsHistory'), days)
        if (next) await repos.meta.set('stepsHistory', next)
      } catch {
        // нет доступа или Health Connect занят — попробуем при следующем открытии
      } finally {
        busy = false
      }
    }
    void sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [repos])

  return null
}
