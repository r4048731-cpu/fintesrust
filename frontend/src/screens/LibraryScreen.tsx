import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { ExerciseBrowser } from '../components/ExerciseBrowser'
import { ExerciseFormSheet } from '../components/ExerciseFormSheet'
import { Screen } from '../components/Screen'
import type { Exercise } from '../domain/types'
import styles from './LibraryScreen.module.css'

type Editing = { kind: 'edit'; exercise: Exercise } | { kind: 'new'; name: string } | null

/** Справочник упражнений (ТЗ 2.1): поиск, фильтр, свои упражнения. */
export function LibraryScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => repos.exercises.list(), [repos])
  const [editing, setEditing] = useState<Editing>(null)

  return (
    <Screen
      title="Упражнения"
      eyebrow={exercises ? `В справочнике: ${exercises.length}` : undefined}
      onBack={() => navigate('/programs')}
      action={
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          onClick={() => setEditing({ kind: 'new', name: '' })}
        >
          Своё
        </Button>
      }
    >
      <div className={styles.browser}>
        {exercises && (
          <ExerciseBrowser
            exercises={exercises}
            mode="edit"
            onSelect={(exercise) => setEditing({ kind: 'edit', exercise })}
            renderEmpty={(query) => (
              <Button variant="primary" onClick={() => setEditing({ kind: 'new', name: query })}>
                {query ? `Создать «${query}»` : 'Создать упражнение'}
              </Button>
            )}
          />
        )}
      </div>
      <ExerciseFormSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        exercise={editing?.kind === 'edit' ? editing.exercise : null}
        defaults={editing?.kind === 'new' ? { name: editing.name } : undefined}
      />
    </Screen>
  )
}
