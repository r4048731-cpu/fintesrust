import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { useNow } from '../app/hooks/useNow'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon, type IconName } from '../components/Icon'
import { Screen, SectionLabel } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { WeightEntry } from '../components/WeightEntry'
import { formatLongDate } from '../components/dates'
import { plural } from '../domain/plural'
import { formatPlan } from '../domain/programs'
import { countSets, formatClock } from '../domain/workout'
import { useToday, type TodayPlan } from './today/useToday'
import { WeekStrip } from './today/WeekStrip'
import styles from './TodayScreen.module.css'

export function TodayScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const t = useToday()
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const now = useNow(1000, !!t.active)
  const programs = useLiveQuery(() => repos.programs.list(), [repos])

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

  const activeBanner = t.active && (
    <button type="button" className={styles.live} onClick={() => navigate('/workout')}>
      <span className={styles.liveText}>
        <span className={styles.liveLabel}>Тренировка идёт</span>
        <span className={styles.liveName}>{t.active.name}</span>
        <span className={styles.liveMeta}>
          {countSets(t.active).done} из {countSets(t.active).total} подходов
        </span>
      </span>
      <span className={styles.liveClock}>{formatClock((now - t.active.startedAt) / 1000)}</span>
      <Icon name="chevron" />
    </button>
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
    <button
      type="button"
      className={styles.weekButton}
      onClick={() => navigate('/progress')}
      aria-label="Эта неделя — открыть прогресс"
    >
      <WeekStrip days={t.week.days} count={t.week.count} tonnageKg={t.week.tonnageKg} />
    </button>
  )

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
      {t.plan && <PlanList plan={t.plan} onEdit={editPlan} />}
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
      <WeightEntry title="Вес сегодня" />
      {extras}
      {t.plan && !t.active && (
        <>
          {/* место под закреплённую кнопку, чтобы она не закрывала низ экрана */}
          <div className={styles.startBarSpace} aria-hidden="true" />
          <div className={styles.startBar}>
            <Button variant="primary" block onClick={() => void t.plan!.start()}>
              Начать тренировку
            </Button>
          </div>
        </>
      )}

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

/** Вариант «Список»: компактный план дня, кнопка «Начать» закреплена внизу. */
function PlanList({ plan, onEdit }: { plan: TodayPlan; onEdit: () => void }) {
  return (
    <section className={styles.card} aria-label={plan.source}>
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
      {plan.items.length > 0 && (
        <ol className={styles.listPlan}>
          {plan.items.map((i, n) => (
            <li key={n}>
              <span className={styles.listNum}>{n + 1}</span>
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
