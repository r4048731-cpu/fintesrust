import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../../app/dataContext'
import { ActiveWorkoutExistsError } from '../../data'
import { backupIsDue } from '../../data/backup'
import {
  activitySummary,
  toISODate,
  weekStart,
  weekStreak,
  workoutTonnage,
} from '../../domain/metrics'
import {
  deloadActive,
  deloadAdvice,
  deloadSets,
  endDeload,
  startDeload,
  trainingBlock,
  DELOAD_SNOOZE_DAYS,
  type DeloadAdvice,
  type DeloadWeek,
} from '../../domain/deload'
import { addDays } from '../../domain/nutrition'
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
  /** `light` берётся в момент нажатия, а не из пересчитанного плана — он обновляется с задержкой. */
  start: (options?: { light?: boolean }) => Promise<void>
  programId?: string
  /** Дни активной программы — чтобы начать не следующий по кругу, а любой. */
  days?: { id: string; name: string }[]
  dayId?: string
  /** Идёт неделя разгрузки: подходов в плане уже меньше. */
  deload?: boolean
}

export interface WeekDay {
  date: string
  label: string
  done: boolean
  today: boolean
  /** Завершённые тренировки этого дня — для шторки по нажатию на день. */
  workouts: Workout[]
  /** Запланированные на этот день. */
  planned: Workout[]
}

const WEEK_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
/** Цель недели без активной программы — две тренировки. */
export const DEFAULT_WEEK_GOAL = 2

/** Цель «Авто»: столько тренировок, сколько дней в активной программе (1–7). */
export function autoWeekGoal(programDays: number | undefined): number {
  return Math.min(7, Math.max(1, programDays ?? DEFAULT_WEEK_GOAL))
}
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
  /** Выбранный на экране день программы; null — следующий по кругу. */
  const [pickedDayId, setPickedDayId] = useState<string | null>(null)
  /** Лёгкий день: веса на 20 % ниже. */
  const [light, setLight] = useState(false)
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
    const day = program.days.find((d) => d.id === pickedDayId) ?? next.day
    const deload = deloadActive(await repos.meta.get('deload'), today)
    const dayItems = deload
      ? day.items.map((item) => ({ ...item, sets: deloadSets(item.sets) }))
      : day.items
    const items = await Promise.all(
      dayItems.map(async (item) => {
        const exercise = await repos.exercises.get(item.exerciseId)
        return { name: exercise?.name ?? 'Упражнение', item, exercise, sets: item.sets }
      }),
    )
    return {
      kind: 'program',
      title: day.name,
      source: program.name,
      items,
      minutes: estimateMinutes(dayItems),
      start: (options) =>
        run(() =>
          repos.workouts.start({ programId: program.id, dayId: day.id }, { light: options?.light }),
        ),
      programId: program.id,
      days: program.days.map((d) => ({ id: d.id, name: d.name })),
      dayId: day.id,
      deload,
    }
  }, [repos, today, pickedDayId])

  /** Разгрузка: идущая неделя или подсказка, что пора. */
  const deload = useLiveQuery(async (): Promise<{
    week: DeloadWeek | null
    advice: DeloadAdvice
  }> => {
    const last = await repos.meta.get('deload')
    if (deloadActive(last, today)) return { week: last, advice: null }
    const snoozed = await repos.meta.get('deloadSnoozedUntil')
    if (snoozed && today <= snoozed) return { week: null, advice: null }
    const block = trainingBlock(await repos.workouts.listDone(), last?.until ?? null, today)
    return { week: null, advice: deloadAdvice(block) }
  }, [repos, today])

  const week = useLiveQuery(async () => {
    const done = await repos.workouts.listDone()
    const planned = await repos.workouts.listPlanned()
    const monday = weekStart(new Date())
    const days: WeekDay[] = WEEK_LABELS.map((label, i) => {
      const date = toISODate(
        new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
      )
      const workouts = done.filter((w) => w.date === date)
      return {
        date,
        label,
        done: workouts.length > 0,
        today: date === today,
        workouts,
        planned: planned.filter((w) => w.date === date),
      }
    })
    const thisWeek = done.filter((w) => w.date >= days[0].date && w.date <= days[6].date)
    // цель недели — своя из настроек или по числу дней активной программы
    const program = await repos.programs.getActive()
    const goal = (await repos.meta.get('weekGoal')) ?? autoWeekGoal(program?.days.length)
    return {
      streak: weekStreak(done, goal, new Date()),
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
    light,
    setLight,
    pickDay: setPickedDayId,
    startFree: () => run(() => repos.workouts.start(null)),
    repeatLast: (id: string) => run(() => repos.workouts.repeat(id)),
    deload,
    startDeload: () => repos.meta.set('deload', startDeload(today)),
    endDeload: (week: DeloadWeek) => repos.meta.set('deload', endDeload(week, today)),
    snoozeDeload: () =>
      repos.meta.set('deloadSnoozedUntil', addDays(today, DELOAD_SNOOZE_DAYS - 1)),
  }
}
