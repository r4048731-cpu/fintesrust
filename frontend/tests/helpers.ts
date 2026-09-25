import { createRepositories, FitnessDB } from '../src/data'

/** Управляемые часы: время в тестах не зависит от даты запуска. */
export function manualClock(start = new Date(2026, 8, 21, 18, 0).getTime()) {
  let now = start
  const clock = () => now
  clock.advance = (ms: number) => {
    now += ms
  }
  clock.set = (date: Date) => {
    now = date.getTime()
  }
  return clock
}

/** Новая пустая база с уникальным именем для каждого теста. */
export async function setup() {
  const clock = manualClock()
  const db = new FitnessDB(`test-${crypto.randomUUID()}`)
  const repos = createRepositories(db, clock)
  await repos.init()
  return { ...repos, clock }
}

export const DAY = 24 * 60 * 60 * 1000
