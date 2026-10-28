import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import { similarExercises } from '../domain/similar'
import type { Exercise } from '../domain/types'
import { Button } from './Button'
import { ExerciseBrowser } from './ExerciseBrowser'
import { ExerciseFormSheet } from './ExerciseFormSheet'
import { Sheet } from './Sheet'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (exercise: Exercise) => void
  title?: string
  /** Заменяем это упражнение: сверху — похожие на него. */
  similarTo?: Exercise
}

/**
 * Выбор упражнения для программы или тренировки (этапы 4 и 5). Если нужного нет,
 * его можно сразу создать: новое упражнение выбирается автоматически.
 */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Добавить упражнение',
  similarTo,
}: Props) {
  const repos = useRepos()
  const exercises = useLiveQuery(() => repos.exercises.list(), [repos])
  const [createName, setCreateName] = useState<string | null>(null)

  return (
    <>
      <Sheet open={open} onClose={onClose} title={title}>
        {open && exercises && (
          <ExerciseBrowser
            exercises={exercises}
            mode="add"
            onSelect={onPick}
            suggested={similarTo && similarExercises(similarTo, exercises)}
            renderEmpty={(query) => (
              <Button icon="plus" variant="primary" onClick={() => setCreateName(query)}>
                {query ? `Создать «${query}»` : 'Создать упражнение'}
              </Button>
            )}
          />
        )}
        {open && <Button onClick={() => setCreateName('')}>Создать своё упражнение</Button>}
      </Sheet>
      <ExerciseFormSheet
        open={createName !== null}
        onClose={() => setCreateName(null)}
        defaults={{ name: createName ?? '' }}
        onSaved={onPick}
      />
    </>
  )
}
