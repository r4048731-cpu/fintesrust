import { useEffect, useState, type ReactNode } from 'react'
import { createRepositories, FitnessDB, type Repositories } from '../data'
import { DataContext } from './dataContext'

let appRepos: Repositories | null = null
function defaultRepos(): Repositories {
  appRepos ??= createRepositories(new FitnessDB())
  return appRepos
}

interface Props {
  children: ReactNode
  /** В тестах передаётся своя база; в приложении — общая на всё время работы. */
  repos?: Repositories
}

/** Открывает базу, при первом запуске заполняет справочник и даёт репозитории экранам. */
export function DataProvider({ children, repos }: Props) {
  const [value] = useState(() => repos ?? defaultRepos())
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    value
      .init()
      .then(() => !cancelled && setState('ready'))
      .catch((err: unknown) => {
        console.error(err)
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [value])

  if (state === 'error') {
    return (
      <div role="alert" style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20 }}>Не удалось открыть хранилище</h1>
        <p>
          Браузер не дал приложению сохранять данные. Так бывает в режиме инкогнито. Откройте
          приложение в обычной вкладке.
        </p>
      </div>
    )
  }
  if (state === 'loading') return null

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
