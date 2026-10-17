import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { ExerciseBrowser } from '../components/ExerciseBrowser'
import { ExerciseFormSheet } from '../components/ExerciseFormSheet'
import { ExerciseInfoSheet } from '../components/ExerciseInfoSheet'
import { Screen } from '../components/Screen'
import type { Exercise } from '../domain/types'
import styles from './LibraryScreen.module.css'

type Tab = 'technique' | 'history'

/** Справочник упражнений (ТЗ 2.1): поиск, фильтр, свои упражнения. */
export function LibraryScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => repos.exercises.list(), [repos])
  /** Имя нового упражнения: шторка создания открыта, когда не null. */
  const [creating, setCreating] = useState<string | null>(null)
  const [card, setCard] = useState<{ exercise: Exercise; tab: Tab } | null>(null)

  return (
    <Screen
      title="Упражнения"
      eyebrow={exercises ? `В справочнике: ${exercises.length}` : undefined}
      onBack={() => navigate('/programs')}
      action={
        <Button variant="primary" size="sm" icon="plus" onClick={() => setCreating('')}>
          Своё
        </Button>
      }
    >
      <div className={styles.browser}>
        {exercises && (
          <ExerciseBrowser
            exercises={exercises}
            mode="edit"
            onSelect={(exercise) => setCard({ exercise, tab: 'technique' })}
            renderEmpty={(query) => (
              <Button variant="primary" onClick={() => setCreating(query)}>
                {query ? `Создать «${query}»` : 'Создать упражнение'}
              </Button>
            )}
          />
        )}
      </div>
      <ExerciseInfoSheet
        exercise={card?.exercise ?? null}
        tab={card?.tab ?? 'technique'}
        onTab={(tab) => card && setCard({ ...card, tab })}
        onClose={() => setCard(null)}
      />
      <ExerciseFormSheet
        open={creating !== null}
        onClose={() => setCreating(null)}
        defaults={{ name: creating ?? '' }}
      />
    </Screen>
  )
}
