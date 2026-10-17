// Сводка данных пользователя для ИИ-помощника. Отправляется, только если включён
// переключатель «Учитывать мои данные». Коротко: модели с бесплатным доступом
// принимают ограниченный объём текста.

import { addDays, sumNutrients } from '../domain/nutrition'
import { doneSets, toISODate, workoutTonnage } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import { formatSet } from '../domain/workout'
import type { Repositories } from './index'

const WORKOUTS = 5
const WEIGHTS = 10
const FOOD_DAYS = 7

export async function buildAiContext(repos: Repositories, now = new Date()): Promise<string> {
  const today = toISODate(now)
  const exercises = new Map((await repos.db.exercises.toArray()).map((e) => [e.id, e]))
  const lines: string[] = [`Сегодня ${today}.`]

  const program = await repos.programs.getActive()
  if (program) {
    lines.push(
      `Активная программа «${program.name}»: ` +
        program.days.map((d) => `${d.name} (${d.items.length} упр.)`).join(', ') +
        '.',
    )
  }

  const workouts = (await repos.workouts.listDone()).slice(0, WORKOUTS)
  if (workouts.length) {
    lines.push('Последние тренировки:')
    for (const w of workouts) {
      const parts = w.entries
        .map((e) => {
          const ex = exercises.get(e.exerciseId)
          const sets = doneSets(e.sets)
          if (!ex || !sets.length) return null
          return (
            `${ex.name}${e.superset ? ' (суперсет)' : ''}: ${sets.map((s) => formatSet(s, ex.type)).join(', ')}` +
            (e.note?.trim() ? ` — заметка: ${e.note.trim()}` : '')
          )
        })
        .filter(Boolean)
      lines.push(
        `- ${w.date} «${w.name}», тоннаж ${Math.round(workoutTonnage(w))} кг: ${parts.join('; ')}`,
      )
    }
  } else {
    lines.push('Тренировок пока не записано.')
  }

  const weights = (await repos.bodyWeights.list()).slice(-WEIGHTS)
  if (weights.length) {
    lines.push(
      'Вес тела: ' +
        weights.map((w) => `${w.date} ${formatDecimal(w.weightKg)} кг`).join(', ') +
        '.',
    )
  }

  const profile = await repos.meta.get('bodyProfile')
  if (profile) lines.push(`Профиль: ${JSON.stringify(profile)}.`)
  const plan = await repos.meta.get('nutritionPlan')
  if (plan) {
    lines.push(
      `План питания на день: ${Math.round(plan.calories)} ккал, Б ${Math.round(plan.protein)} г, Ж ${Math.round(plan.fat)} г, У ${Math.round(plan.carbs)} г.`,
    )
  }
  const meals = await repos.meals.listRange(addDays(today, -(FOOD_DAYS - 1)), today)
  if (meals.length) {
    const byDay = new Map<string, typeof meals>()
    for (const m of meals) byDay.set(m.date, [...(byDay.get(m.date) ?? []), m])
    lines.push('Питание по дням:')
    for (const [date, list] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
      const t = sumNutrients(list)
      lines.push(
        `- ${date}: ${Math.round(t.calories)} ккал, Б ${Math.round(t.protein)}, Ж ${Math.round(t.fat)}, У ${Math.round(t.carbs)}` +
          (date === today ? ` (сегодня: ${list.map((m) => m.name).join(', ')})` : ''),
      )
    }
  }
  return lines.join('\n')
}
