// Кольца дня на «Сегодня»: тренировка, калории, шаги — доля от цели и подпись.

import { formatInteger } from './number'

export interface Ring {
  /** Доля от цели, 0…1 (больше цели — всё равно полное кольцо). */
  share: number
  /** Главная подпись: «12 из 20 подходов», «1 450 / 2 200 ккал». */
  value: string
  done: boolean
}

const part = (value: number, goal: number) =>
  goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0

/**
 * Тренировка: идёт — доля отмеченных подходов; уже была сегодня — полное кольцо;
 * ещё не было — пустое.
 */
export function trainingRing(
  active: { done: number; total: number } | null,
  doneToday: number,
): Ring {
  if (active) {
    const share = part(active.done, active.total)
    return { share, value: `${active.done} из ${active.total} подходов`, done: false }
  }
  if (doneToday > 0)
    return { share: 1, value: doneToday > 1 ? `${doneToday} тренировки` : 'Выполнена', done: true }
  return { share: 0, value: 'Ещё не было', done: false }
}

/** Калории против плана питания; без плана кольцо пустое. */
export function caloriesRing(eaten: number, plan: number | null): Ring {
  const kcal = Math.round(eaten)
  if (!plan)
    return { share: 0, value: kcal ? `${formatInteger(kcal)} ккал` : 'План не задан', done: false }
  const over = kcal - Math.round(plan)
  return {
    share: part(kcal, plan),
    value:
      over > 0
        ? `+${formatInteger(over)} сверх плана`
        : `${formatInteger(kcal)} / ${formatInteger(plan)} ккал`,
    done: kcal >= plan * 0.9,
  }
}

export function stepsRing(steps: number, goal: number): Ring {
  return {
    share: part(steps, goal),
    value: `${formatInteger(steps)} / ${formatInteger(goal)}`,
    done: steps >= goal,
  }
}
