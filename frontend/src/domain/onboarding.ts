// Первый запуск: знакомство в 3 шага — цель, программа, вес — вместо пустых экранов.

import { BUILDER_DEFAULTS, type BuilderInput, type Place } from './builder'
import type { NutritionGoal, ProgramKind } from './types'

/** Показывать знакомство: его ещё не проходили и в приложении пусто. */
export function needsOnboarding(state: {
  onboarded: boolean
  programs: number
  workouts: number
}): boolean {
  return !state.onboarded && state.programs === 0 && state.workouts === 0
}

export interface OnboardingAnswers {
  goal: NutritionGoal
  place: Place
  daysPerWeek: number
  /** Что делать с программой: подобрать, взять шаблон или потом самому. */
  program: 'built' | ProgramKind | 'later'
  /** Вес тела, кг; null — пропустили. */
  weightKg: number | null
}

export const ONBOARDING_DEFAULTS: OnboardingAnswers = {
  goal: 'maintain',
  place: 'gym',
  daysPerWeek: 3,
  program: 'built',
  weightKg: 75,
}

/** Ответы → параметры «Подобрать программу»: остальное по умолчанию, дома — гантели и турник. */
export function onboardingBuilderInput(a: OnboardingAnswers): BuilderInput {
  return {
    ...BUILDER_DEFAULTS,
    goal: a.goal,
    place: a.place,
    daysPerWeek: a.daysPerWeek,
    dumbbells: true,
    pullUpBar: true,
    ...(a.weightKg ? { weightKg: a.weightKg } : {}),
  }
}
