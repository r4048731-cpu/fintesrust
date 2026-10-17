import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { gpsAvailable } from '../app/gps'
import { Button } from '../components/Button'
import { Chips } from '../components/Field'
import { RunHistory } from '../components/run/RunHistory'
import { Screen } from '../components/Screen'
import { Segmented } from '../components/Segmented'
import { ActiveRunExistsError } from '../data/repositories/runs'
import { formatKm, RUN_KINDS, type RunGoal, type RunKind } from '../domain/run'
import styles from './RunScreen.module.css'

type GoalKey = 'free' | 'd3' | 'd5' | 'd10' | 't20' | 't30' | 't60'

const GOALS: { value: GoalKey; label: string; goal: RunGoal }[] = [
  { value: 'free', label: 'Свободно', goal: { type: 'free' } },
  { value: 'd3', label: '3 км', goal: { type: 'distance', meters: 3000 } },
  { value: 'd5', label: '5 км', goal: { type: 'distance', meters: 5000 } },
  { value: 'd10', label: '10 км', goal: { type: 'distance', meters: 10000 } },
  { value: 't20', label: '20 мин', goal: { type: 'time', sec: 20 * 60 } },
  { value: 't30', label: '30 мин', goal: { type: 'time', sec: 30 * 60 } },
  { value: 't60', label: '60 мин', goal: { type: 'time', sec: 60 * 60 } },
]

/** «Бег и ходьба»: выбор вида и цели, старт, итоги и последние пробежки. */
export function RunScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const active = useLiveQuery(() => repos.runs.getActive(), [repos])
  const [kind, setKind] = useState<RunKind>('run')
  const [goal, setGoal] = useState<GoalKey>('free')
  const [error, setError] = useState<string | null>(null)
  const gps = gpsAvailable()

  async function start() {
    setError(null)
    try {
      await repos.runs.start(kind, GOALS.find((g) => g.value === goal)!.goal)
    } catch (err) {
      if (!(err instanceof ActiveRunExistsError)) {
        setError('Не удалось начать. Попробуйте ещё раз.')
        return
      }
    }
    navigate('/run/active')
  }

  return (
    <Screen title="Бег и ходьба" onBack={() => navigate(-1)}>
      {active && (
        <button
          type="button"
          className={styles.activeBanner}
          onClick={() => navigate('/run/active')}
        >
          <b>{active.kind === 'run' ? 'Пробежка' : 'Прогулка'} идёт</b>
          <span>{formatKm(active.distanceM)} км · вернуться</span>
        </button>
      )}

      {!active && (
        <section className={styles.start} aria-label="Новая пробежка">
          <Segmented label="Вид" options={RUN_KINDS} value={kind} onChange={setKind} />
          <Chips label="Цель" options={GOALS} value={goal} onChange={setGoal} />
          {!gps && (
            <p className={styles.warn} role="note">
              GPS работает только в защищённом режиме — по ссылке https://. Откройте приложение по
              такой ссылке после публикации.
            </p>
          )}
          <Button variant="primary" block disabled={!gps} onClick={start} className={styles.go}>
            Старт
          </Button>
          {error && (
            <p role="alert" className={styles.warn}>
              {error}
            </p>
          )}
          <p className={styles.hint}>
            Пишем маршрут, пока приложение открыто: экран не гаснет. Телефон можно держать в руке
            или в кармане с включённым экраном.
          </p>
        </section>
      )}

      <RunHistory />
    </Screen>
  )
}
