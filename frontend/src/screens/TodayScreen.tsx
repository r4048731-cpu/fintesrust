import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { useNow } from '../app/hooks/useNow'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon, type IconName } from '../components/Icon'
import { LiveCard, LiveIcon } from '../components/LiveCard'
import { Screen, SectionLabel } from '../components/Screen'
import { Segmented } from '../components/Segmented'
import { Sheet } from '../components/Sheet'
import { formatLongDate } from '../components/dates'
import { plural } from '../domain/plural'
import { doneSetCount, parseISODate, workoutTonnage } from '../domain/metrics'
import { formatInteger } from '../domain/number'
import { formatPlan } from '../domain/programs'
import { formatKm } from '../domain/run'
import { StepsCard } from '../components/steps/StepsCard'
import { isAndroidApp } from '../native/steps'
import { countSets, formatClock } from '../domain/workout'
import { useToday, type TodayPlan, type WeekDay } from './today/useToday'
import { WeekStrip } from './today/WeekStrip'
import { DayRings } from '../components/DayRings'
import { ExerciseThumb } from '../components/ExerciseThumb'
import frame from '../components/frame.module.css'
import styles from './TodayScreen.module.css'

export function TodayScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const t = useToday()
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const now = useNow(1000, !!t.active)
  const programs = useLiveQuery(() => repos.programs.list(), [repos])
  const activeRun = useLiveQuery(() => repos.runs.getActive(), [repos])

  if (t.active === undefined || t.plan === undefined || !t.week) return null

  const quick: { icon: IconName; label: string; aria?: string; onClick: () => void }[] = [
    ...(!t.active && programs?.length
      ? [{ icon: 'programs' as const, label: 'Другой день', onClick: () => setDayPickerOpen(true) }]
      : []),
    ...(!t.active
      ? [
          {
            icon: 'plus' as const,
            label: 'Свободная',
            aria: 'Свободная тренировка без плана',
            onClick: () => void t.startFree(),
          },
        ]
      : []),
    ...(!t.active && t.week.last
      ? [
          {
            icon: 'history' as const,
            label: 'Повторить',
            aria: `Повторить прошлую тренировку «${t.week.last.name}»`,
            onClick: () => void t.repeatLast(t.week!.last!.id),
          },
        ]
      : []),
  ]

  const liveSets = t.active ? countSets(t.active) : null
  const activeBanner = t.active && liveSets && (
    <LiveCard
      label="Тренировка идёт"
      title={t.active.name}
      meta={`${liveSets.done} из ${liveSets.total} подходов`}
      onClick={() => navigate('/workout')}
      // Кольцо — доля отмеченных подходов, внутри — время тренировки
      lead={
        <span className={styles.liveRing}>
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <linearGradient id="live-ring" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--blue)' }} />
                <stop offset="55%" style={{ stopColor: 'var(--violet)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--pink)' }} />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="28" className={styles.liveTrack} />
            <circle
              cx="32"
              cy="32"
              r="28"
              pathLength={100}
              className={styles.liveArc}
              style={{
                strokeDasharray: `${liveSets.total ? (100 * liveSets.done) / liveSets.total : 0} 100`,
              }}
            />
          </svg>
          <span className={styles.liveClock}>{formatClock((now - t.active.startedAt) / 1000)}</span>
        </span>
      }
    />
  )

  const noProgram = t.plan === null && (
    <EmptyState
      title="Составьте первую программу"
      action={
        <Button variant="primary" onClick={() => navigate('/programs')}>
          Перейти к программам
        </Button>
      }
    >
      <p>Приложение будет предлагать её дни по кругу.</p>
    </EmptyState>
  )

  const week = (
    <WeekStrip
      days={t.week.days}
      count={t.week.count}
      tonnageKg={t.week.tonnageKg}
      streak={t.week.streak}
      onPickDay={(d) => setPickedDate(d.date)}
      onSummary={() => navigate('/progress')}
    />
  )
  /** День берётся из свежих данных недели, чтобы шторка обновлялась вместе с ними. */
  const pickedDay = t.week.days.find((d) => d.date === pickedDate)

  const editPlan = () => t.plan?.programId && navigate(`/programs/${t.plan.programId}`)

  const extras = (
    <>
      {t.week.backupDue && !t.active && (
        <button type="button" className={styles.reminder} onClick={() => navigate('/settings')}>
          <span className={styles.reminderTitle}>Сохраните резервную копию</span>
          <span className={styles.reminderText}>Данные хранятся только на этом телефоне.</span>
        </button>
      )}
      {t.error && (
        <p role="alert" className={styles.error}>
          {t.error}
        </p>
      )}
    </>
  )

  return (
    <Screen title="Сегодня" eyebrow={formatLongDate(new Date())}>
      {activeBanner}
      {noProgram}

      {week}
      <DayRings
        active={liveSets}
        doneToday={t.week.days.find((d) => d.today)?.workouts.length ?? 0}
      />
      {isAndroidApp() && <StepsCard />}
      {activeRun ? (
        <LiveCard
          label={`${activeRun.kind === 'run' ? 'Пробежка' : 'Прогулка'} идёт`}
          title={`${formatKm(activeRun.distanceM)} км`}
          meta="Маршрут пишется · вернуться"
          onClick={() => navigate('/run/active')}
          lead={
            <LiveIcon>
              <Icon name="run" size={24} />
            </LiveIcon>
          }
        />
      ) : (
        <button type="button" className={styles.runCard} onClick={() => navigate('/run')}>
          <span className={styles.runIcon}>
            <Icon name="run" />
          </span>
          <span className={styles.runText}>
            <b>Бег и ходьба</b>
            <span>Маршрут, километры и темп по GPS</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      )}
      {t.plan && (
        <PlanList
          plan={t.plan}
          onEdit={editPlan}
          onPickDay={t.active ? undefined : t.pickDay}
          light={t.light}
          onLight={t.active ? undefined : t.setLight}
        />
      )}
      <div className={styles.chips}>
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            className={styles.chip}
            onClick={q.onClick}
            aria-label={q.aria}
          >
            <Icon name={q.icon} size={18} />
            {q.label}
          </button>
        ))}
      </div>
      {extras}
      {t.plan && !t.active && (
        <>
          {/* место под закреплённую кнопку, чтобы она не закрывала низ экрана */}
          <div className={styles.startBarSpace} aria-hidden="true" />
          <div className={styles.startBar} data-start-bar data-pinned>
            <Button variant="primary" block onClick={() => void t.plan!.start({ light: t.light })}>
              Начать: {t.plan.title}
              {t.plan.kind === 'program' && t.light ? ' · лёгкий' : ''}
            </Button>
          </div>
        </>
      )}

      <Sheet
        open={!!pickedDay}
        onClose={() => setPickedDate(null)}
        title={pickedDay ? formatLongDate(parseISODate(pickedDay.date)) : ''}
      >
        {pickedDay && <DayWorkouts day={pickedDay} onOpen={(path) => navigate(path)} />}
      </Sheet>

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
                    onClick={async () => {
                      setDayPickerOpen(false)
                      try {
                        await repos.workouts.start({ programId: p.id, dayId: d.id })
                      } finally {
                        navigate('/workout')
                      }
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

function planLine(i: TodayPlan['items'][number]): string {
  if (i.item) return formatPlan(i.item, i.exercise?.type ?? 'weight')
  return `${i.sets} ${plural(i.sets, 'подход', 'подхода', 'подходов')}`
}

function metaLine(plan: TodayPlan): string {
  const n = plan.items.length
  return n
    ? `${n} ${plural(n, 'упражнение', 'упражнения', 'упражнений')} · ~${plan.minutes} мин`
    : 'Пока без упражнений'
}

const LOADS: { value: 'heavy' | 'light'; label: string }[] = [
  { value: 'heavy', label: 'Тяжёлая' },
  { value: 'light', label: 'Лёгкая −20%' },
]

/**
 * План дня списком, кнопка «Начать» закреплена внизу. У программы — выбор дня
 * и нагрузки: в лёгкий день рабочие веса ниже на 20 %.
 */
function PlanList({
  plan,
  onEdit,
  onPickDay,
  light,
  onLight,
}: {
  plan: TodayPlan
  onEdit: () => void
  onPickDay?: (id: string) => void
  light: boolean
  onLight?: (light: boolean) => void
}) {
  return (
    <section className={`${styles.card} ${frame.frame}`} aria-label={plan.source}>
      <div className={styles.listHead}>
        <div>
          <span className={styles.listSource}>{plan.source}</span>
          <h2 className={styles.listTitle}>{plan.title}</h2>
          <span className={styles.listMeta}>{metaLine(plan)}</span>
        </div>
        {plan.kind === 'program' && (
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Изменить программу">
            Изменить
          </Button>
        )}
      </div>
      {onPickDay && plan.days && plan.days.length > 1 && (
        <div className={styles.days} role="group" aria-label="День программы">
          {plan.days.map((d) => (
            <button
              key={d.id}
              type="button"
              className={styles.day}
              aria-pressed={d.id === plan.dayId}
              onClick={() => onPickDay(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
      {onLight && plan.kind === 'program' && plan.items.length > 0 && (
        <Segmented
          label="Нагрузка"
          options={LOADS}
          value={light ? 'light' : 'heavy'}
          onChange={(v) => onLight(v === 'light')}
        />
      )}
      {plan.items.length > 0 && (
        <ol className={styles.listPlan}>
          {plan.items.map((i, n) => (
            <li key={n}>
              <ExerciseThumb exercise={i.exercise ?? { id: '', name: i.name }} mark={n + 1} />
              <span className={styles.listText}>
                <span>{i.name}</span>
                <span className={styles.planText}>{planLine(i)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Шторка дня из полоски недели: что было и что запланировано. */
function DayWorkouts({ day, onOpen }: { day: WeekDay; onOpen: (path: string) => void }) {
  if (!day.workouts.length && !day.planned.length)
    return (
      <p className={styles.dayEmpty}>
        {day.today ? 'Сегодня тренировки ещё не было.' : 'В этот день тренировки не было.'}
      </p>
    )
  return (
    <ul className={styles.pickList}>
      {day.workouts.map((w) => {
        const sets = doneSetCount(w)
        return (
          <li key={w.id}>
            <button
              type="button"
              className={styles.pickRow}
              onClick={() => onOpen(`/history/${w.id}`)}
            >
              <span className={styles.pickName}>{w.name}</span>
              <span className={styles.dayMeta}>
                {sets} {plural(sets, 'подход', 'подхода', 'подходов')} ·{' '}
                {formatInteger(workoutTonnage(w))} кг
              </span>
            </button>
          </li>
        )
      })}
      {day.planned.map((w) => (
        <li key={w.id}>
          <button
            type="button"
            className={styles.pickRow}
            onClick={() => onOpen(`/history/${w.id}/edit`)}
          >
            <span className={styles.pickName}>{w.name}</span>
            <span className={styles.dayMeta}>Запланирована</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
