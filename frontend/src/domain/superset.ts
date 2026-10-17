// Суперсеты: соседние упражнения с одинаковой меткой `superset` выполняются по кругу без
// отдыха между ними — отдых только после последнего упражнения круга. Метка одна и та же
// в дне программы (PlanItem) и в тренировке (WorkoutEntry).

import { newId } from './id'

interface Linkable {
  superset?: string | null
}

/**
 * Приводит метки в порядок: группа — только из идущих подряд упражнений и минимум из двух.
 * Нужна после перестановки, удаления и замены упражнений.
 */
export function normalizeSupersets<T extends Linkable>(list: T[]): T[] {
  const seen = new Set<string>()
  const out = list.map((item) => ({ ...item }))
  // разорванная группа: вторая часть получает новую метку
  let i = 0
  while (i < out.length) {
    const id = out[i].superset
    let j = i
    while (j + 1 < out.length && id && out[j + 1].superset === id) j++
    if (id) {
      const fresh = seen.has(id) ? newId() : id
      seen.add(id)
      for (let k = i; k <= j; k++) out[k].superset = fresh
      if (i === j) out[i].superset = null // в одиночку суперсета нет
    }
    i = j + 1
  }
  return out.map((item) => {
    if (item.superset) return item
    const rest = { ...item }
    delete rest.superset
    return rest
  })
}

/** Связано ли упражнение `i` со следующим. */
export function linkedToNext(list: Linkable[], i: number): boolean {
  const id = list[i]?.superset
  return !!id && list[i + 1]?.superset === id
}

/** Объединить упражнение `i` со следующим в суперсет или разъединить их. */
export function toggleLink<T extends Linkable>(list: T[], i: number): T[] {
  if (i < 0 || i + 1 >= list.length) return list
  const out = list.map((item) => ({ ...item }))
  if (linkedToNext(out, i)) {
    // разрезаем группу между i и i + 1: вторая половина — отдельная группа (или одиночка)
    const [, end] = supersetSpan(out, i)
    const fresh = newId()
    for (let k = i + 1; k <= end; k++) out[k].superset = fresh
  } else {
    // i и вся группа следующего упражнения получают общую метку
    const id = out[i].superset ?? newId()
    const [, end] = supersetSpan(out, i + 1)
    out[i].superset = id
    for (let k = i + 1; k <= end; k++) out[k].superset = id
  }
  return normalizeSupersets(out)
}

/** Границы группы, в которой упражнение `i`: [первое, последнее]; без суперсета — [i, i]. */
export function supersetSpan(list: Linkable[], i: number): [number, number] {
  const id = list[i]?.superset
  if (!id) return [i, i]
  let a = i
  let b = i
  while (a > 0 && list[a - 1].superset === id) a--
  while (b + 1 < list.length && list[b + 1].superset === id) b++
  return [a, b]
}
