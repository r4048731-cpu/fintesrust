import { createContext, useContext } from 'react'
import type { Repositories } from '../data'

export const DataContext = createContext<Repositories | null>(null)

/** Репозитории для экранов. Работает только внутри DataProvider. */
export function useRepos(): Repositories {
  const repos = useContext(DataContext)
  if (!repos) throw new Error('useRepos вызван вне DataProvider')
  return repos
}
