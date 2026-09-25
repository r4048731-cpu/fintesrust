import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../../app/dataContext'
import { ActiveWorkoutExistsError } from '../../data'
import { backupIsDue } from '../../data/backup'
import { activitySummary, toISODate, weekStart, workoutTonnage } from '../../domain/metrics'
import type { Exercise, PlanItem, Workout } from '../../domain/types'

/** Что предложить сегодня: запланированную тренировку или следующий день программы. */
export interface TodayPlan {
  kind: 'planned' | 'program'
  title: string
  /** «Запланировано» или название программы. */
  source: string
  items: { name: string; item: PlanItem | null; exercise?: Exercise; sets: number }[]
  /** Примерная длительность, мин: подходы × (работа 45 с + отдых). */
  minutes: number
  start: () => Promise<void>
  programId?: string
}

export interface WeekDay {
  date: string
  label: string
  done: boolean
  today: boolean
}

const WEEK_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const WORK_SEC = 45

function estimateMinutes(parts: { sets: number; restSec: number }[]): number {
  const sec = parts.reduce((s, p) => s + p.sets * (WORK_SEC + p.restSec), 0)
  return Math.max(5, Math.round(sec / 60 / 5) * 5)
}

/** Данные экрана «Сегодня» — общие для обоих вариантов вида. */
export function useToday() {
  const repos = useRepos()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const today = toISODate(new Date())

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      navigate('/workout')
    } catch (err) {
      if (err instanceof ActiveWorkoutExistsError) navigate('/workout')
      else setError('Не удалось начать тренировку. Попробуйте ещё раз.')
    }
  }

  const active = useLiveQuery(() => repos.workouts.getActive(), [repos])

  const plan = useLiveQuery(async (): Promise<TodayPlan | null> => {
    const planned = await repos.workouts.plannedFor(today)
    if (planned) {
      const items = await Promise.all(
        planned.entries.map(async (e) => {
          const exercise = await repos.exercises.get(e.exerciseId)
          return { name: exercise?.name ?? 'Упражнение', item: null, exercise, sets: e.sets.length }
        }),
      )
      return {
        kind: 'planned',
        title: planned.name,
        source: 'Запланировано на сегодня',
        items,
        minutes: estimateMinutes(
          planned.entries.map((e) => ({ sets: e.sets.length, restSec: e.restSec })),
        ),
        start: () => run(() => repos.workouts.startPlanned(planned.id)),
      }
    }
    const program = await repos.programs.getActive()
    if (!program) return null
    const next = await repos.programs.nextDay(program.id)
    if (!next) return null
    const items = await Promise.all(
      next.day.items.map(async (item) => {
        const exercise = await repos.exercises.get(item.exerciseId)
        return { name: exercise?.name ?? 'Упражнение', item, exercise, sets: item.sets }
      }),
    )
    return {
      kind: 'program',
      title: next.day.name,
      source: program.name,
      items,
      minutes: estimateMinutes(next.day.items),
      start: () => run(() => repos.workouts.start({ programId: program.id, dayId: next.day.id })),
      programId: program.id,
    }
  }, [repos, today])

  const week = useLiveQuery(async () => {
    const done = await repos.workouts.listDone()
    const monday = weekStart(new Date())
    const days: WeekDay[] = WEEK_LABELS.map((label, i) => {
      const date = toISODate(
        new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
      )
      return { date, label, done: done.some((w) => w.date === date), today: date === today }
    })
    const thisWeek = done.filter((w) => w.date >= days[0].date && w.date <= days[6].date)
    return {
      days,
      count: thisWeek.length,
      tonnageKg: thisWeek.reduce((s, w) => s + workoutTonnage(w), 0),
      summary: activitySummary(done, new Date()),
      last: done[0] as Workout | undefined,
      backupDue: backupIsDue(await repos.meta.get('lastExportAt'), done.length, Date.now()),
    }
  }, [repos, today])

  return {
    active,
    plan,
    week,
    error,
    startFree: () => run(() => repos.workouts.start(null)),
    repeatLast: (id: string) => run(() => repos.workouts.repeat(id)),
  }
}
