import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { useRepos } from '../../app/dataContext'
import { formatSleep, GLASS_ML, SLEEP_GOAL_MIN, waterGoalMl, withDay } from '../../domain/trackers'
import type { DayTracker, ISODate } from '../../domain/types'
import { Button, IconButton } from '../Button'
import { Icon, type IconName } from '../Icon'
import { Sheet } from '../Sheet'
import { Stepper } from '../Stepper'
import styles from './DayTrackers.module.css'

/** Дневник питания → «Вода» и «Сон» за выбранный день, как карточки-кольца в дневниках питания. */
export function DayTrackers({ date }: { date: ISODate }) {
  const repos = useRepos()
  const all = useLiveQuery(() => repos.meta.get('dayTrackers'), [repos])
  const weight = useLiveQuery(
    async () => (await repos.bodyWeights.list()).at(-1)?.weightKg ?? null,
    [repos],
  )
  const [sleepOpen, setSleepOpen] = useState(false)
  const queue = useRef(Promise.resolve())
  if (all === undefined || weight === undefined) return null

  const day = all[date] ?? {}
  const water = day.waterMl ?? 0
  const sleep = day.sleepMin ?? 0
  const goal = waterGoalMl(weight)

  // Сохранения идут по очереди и считают от свежей записи: быстрые нажатия «+» не теряются
  function save(patch: (day: DayTracker) => DayTracker) {
    queue.current = queue.current.then(async () => {
      const fresh = await repos.meta.get('dayTrackers')
      await repos.meta.set('dayTrackers', withDay(fresh, date, patch(fresh[date] ?? {})))
    })
    return queue.current
  }

  return (
    <section className={styles.trackers} aria-label="Вода и сон">
      <div className={styles.card}>
        <Ring icon="water" tone="water" value={water / goal} />
        <div className={styles.text}>
          <span className={styles.label}>Вода</span>
          <b>
            {(water / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
            <span> / {(goal / 1000).toLocaleString('ru-RU')} л</span>
          </b>
        </div>
        <div className={styles.actions}>
          <IconButton
            icon="minus"
            size="sm"
            variant="secondary"
            label={`Вода: минус ${GLASS_ML} мл`}
            disabled={water === 0}
            onClick={() => void save((d) => ({ waterMl: (d.waterMl ?? 0) - GLASS_ML }))}
          />
          <IconButton
            icon="plus"
            size="sm"
            variant="primary"
            label={`Вода: плюс ${GLASS_ML} мл`}
            onClick={() => void save((d) => ({ waterMl: (d.waterMl ?? 0) + GLASS_ML }))}
          />
        </div>
      </div>

      <button
        type="button"
        className={`${styles.card} ${styles.tap}`}
        onClick={() => setSleepOpen(true)}
        aria-label={`Сон: ${sleep ? formatSleep(sleep) : 'не записан'} — изменить`}
      >
        <Ring icon="sleep" tone="sleep" value={sleep / SLEEP_GOAL_MIN} />
        <span className={styles.text}>
          <span className={styles.label}>Сон</span>
          <b>{sleep ? formatSleep(sleep) : '—'}</b>
        </span>
        <span className={styles.chevron}>
          <Icon name="chevron" size={20} />
        </span>
      </button>

      <SleepSheet
        key={`${date}-${sleepOpen}`}
        open={sleepOpen}
        initial={sleep || SLEEP_GOAL_MIN}
        onClose={() => setSleepOpen(false)}
        onSave={(min) => {
          setSleepOpen(false)
          void save(() => ({ sleepMin: min }))
        }}
      />
    </section>
  )
}

/** Кольцо с иконкой: заполнено на долю от цели. */
function Ring({ icon, tone, value }: { icon: IconName; tone: 'water' | 'sleep'; value: number }) {
  const pct = Math.min(100, Math.round(value * 100))
  return (
    <span className={styles.ring} data-tone={tone} aria-hidden="true">
      <svg viewBox="0 0 48 48" className={styles.ringSvg}>
        <circle cx="24" cy="24" r="20" className={styles.track} />
        {pct > 0 && (
          <circle
            cx="24"
            cy="24"
            r="20"
            pathLength={100}
            className={styles.arc}
            style={{ strokeDasharray: `${pct} 100` }}
          />
        )}
      </svg>
      <Icon name={icon} size={20} />
    </span>
  )
}

function SleepSheet({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: number
  onClose: () => void
  onSave: (min: number) => void
}) {
  const [hours, setHours] = useState(Math.round((initial / 60) * 2) / 2)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Сколько спали"
      footer={
        <Button icon="check" variant="primary" block onClick={() => onSave(Math.round(hours * 60))}>
          Сохранить
        </Button>
      }
    >
      <div className={styles.sleepForm}>
        <Stepper
          label="Сон, часов"
          value={hours}
          step={0.5}
          min={0}
          max={24}
          decimal
          onChange={setHours}
        />
        <p className={styles.hint}>Норма для восстановления после тренировок — 7–9 часов.</p>
      </div>
    </Sheet>
  )
}
