import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { ActiveWorkoutExistsError } from '../data'
import { toISODate } from '../domain/metrics'
import { Icon, type IconName } from './Icon'
import { MealSheet } from './MealSheet'
import { NoteSheet } from './NoteSheet'
import { Sheet } from './Sheet'
import { WeightEntry } from './WeightEntry'
import styles from './QuickAdd.module.css'

type Open = 'menu' | 'meal' | 'weight' | 'note' | null

interface Props {
  /** Классы кнопки и кружка с «+»: кнопка стоит в центре панели вкладок. */
  className?: string
  iconClassName?: string
  /** Открыть ИИ-помощника — первый пункт меню. */
  onAi: () => void
}

/**
 * Кнопка «+» в центре панели вкладок: самые частые действия с любого экрана —
 * ИИ, тренировка, еда, вес. Еда и вес вводятся прямо в шторке, без перехода.
 */
export function QuickAdd({ className, iconClassName, onAi }: Props) {
  const repos = useRepos()
  const navigate = useNavigate()
  const [open, setOpen] = useState<Open>(null)
  const [error, setError] = useState<string | null>(null)
  const state = useLiveQuery(async () => {
    const active = await repos.workouts.getActive()
    const program = await repos.programs.getActive()
    const next = program ? await repos.programs.nextDay(program.id) : null
    return { active, program, next }
  }, [repos])

  async function start(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
    } catch (err) {
      if (!(err instanceof ActiveWorkoutExistsError)) {
        setError('Не удалось начать тренировку. Попробуйте ещё раз.')
        return
      }
    }
    setOpen(null)
    navigate('/workout')
  }

  const actions: { icon: IconName; title: string; text: string; onClick: () => void }[] = [
    {
      icon: 'ai',
      title: 'Спросить ИИ',
      text: 'Тренировки, питание, восстановление',
      onClick: () => {
        setOpen(null)
        onAi()
      },
    },
  ]
  if (state?.active) {
    actions.push({
      icon: 'today',
      title: 'Продолжить тренировку',
      text: state.active.name,
      onClick: () => {
        setOpen(null)
        navigate('/workout')
      },
    })
  } else {
    if (state?.program && state.next) {
      const { program, next } = state
      actions.push({
        icon: 'today',
        title: 'Начать тренировку',
        text: `${next.day.name} · ${program.name}`,
        onClick: () =>
          void start(() => repos.workouts.start({ programId: program.id, dayId: next.day.id })),
      })
    }
    actions.push({
      icon: 'plus',
      title: 'Свободная тренировка',
      text: 'Без плана, упражнения добавите сами',
      onClick: () => void start(() => repos.workouts.start(null)),
    })
  }
  actions.push(
    {
      icon: 'food',
      title: 'Добавить еду',
      text: 'В дневник за сегодня',
      onClick: () => setOpen('meal'),
    },
    {
      icon: 'scale',
      title: 'Записать вес',
      text: 'Утром или с поправкой на вечер',
      onClick: () => setOpen('weight'),
    },
    {
      icon: 'run',
      title: 'Бег или ходьба',
      text: 'Маршрут, километры и темп по GPS',
      onClick: () => {
        setOpen(null)
        navigate('/run')
      },
    },
    {
      icon: 'timer',
      title: 'Интервальный таймер',
      text: 'Табата, EMOM, круговая — со звуком',
      onClick: () => {
        setOpen(null)
        navigate('/interval')
      },
    },
    {
      icon: 'note',
      title: 'Заметка',
      text: 'Записать мысль, план или настройку',
      onClick: () => setOpen('note'),
    },
  )

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label="Быстро добавить"
        aria-haspopup="dialog"
        onClick={() => {
          setError(null)
          setOpen('menu')
        }}
      >
        <span className={iconClassName}>
          <Icon name="plus" size={24} />
        </span>
      </button>

      <Sheet open={open === 'menu'} onClose={() => setOpen(null)} title="Быстро добавить">
        <ul className={styles.list}>
          {actions.map((a) => (
            <li key={a.title}>
              <button type="button" className={styles.action} onClick={a.onClick}>
                <span className={styles.icon} data-icon={a.icon}>
                  <Icon name={a.icon} />
                </span>
                <span className={styles.text}>
                  <b>{a.title}</b>
                  <span>{a.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </Sheet>

      <MealSheet
        open={open === 'meal'}
        onClose={() => setOpen(null)}
        date={toISODate(new Date())}
        meal={null}
      />

      <NoteSheet open={open === 'note'} onClose={() => setOpen(null)} note={null} />

      <Sheet open={open === 'weight'} onClose={() => setOpen(null)} title="Записать вес">
        <WeightEntry onSaved={() => setOpen(null)} />
      </Sheet>
    </>
  )
}
