// Поиск и сортировка упражнений. Общие для базы и экранов, чтобы список фильтровался одинаково.

import type { Exercise, MuscleGroup } from './types'

export interface ExerciseFilter {
  muscle?: MuscleGroup | null
  /** Поиск по подстроке в названии: без учёта регистра, «ё» и «е» равны. */
  query?: string
}

const collator = new Intl.Collator('ru')

/** «Жим  ЛЁЖА » → «жим лежа». */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е')
}

/** Неудалённые упражнения под фильтр, по алфавиту. */
export function filterExercises(list: Exercise[], filter: ExerciseFilter = {}): Exercise[] {
  const q = normalizeName(filter.query ?? '')
  return list
    .filter((e) => e.deletedAt === null)
    .filter((e) => !filter.muscle || e.muscle === filter.muscle)
    .filter((e) => !q || normalizeName(e.name).includes(q))
    .sort((a, b) => collator.compare(a.name, b.name))
}

/** Есть ли другое неудалённое упражнение с таким же названием. */
export function hasDuplicateName(list: Exercise[], name: string, exceptId?: string): boolean {
  const n = normalizeName(name)
  return list.some((e) => e.deletedAt === null && e.id !== exceptId && normalizeName(e.name) === n)
}
