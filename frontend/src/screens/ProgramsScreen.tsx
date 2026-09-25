import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Screen, SectionLabel } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { MUSCLE_GROUPS, MUSCLE_LABELS } from '../domain/types'
import styles from './ProgramsScreen.module.css'

export function ProgramsScreen() {
  const repos = useRepos()
  const programs = useLiveQuery(() => repos.programs.list(), [repos])
  const exercises = useLiveQuery(() => repos.exercises.list(), [repos])
  const [libraryOpen, setLibraryOpen] = useState(false)

  return (
    <Screen
      title="Программы"
      action={
        <Button size="sm" onClick={() => setLibraryOpen(true)}>
          Упражнения
        </Button>
      }
    >
      {programs?.length === 0 && (
        <EmptyState title="Программ пока нет">
          <p>Здесь появится редактор программ: дни, упражнения, подходы, повторения и вес.</p>
        </EmptyState>
      )}
      {programs && programs.length > 0 && (
        <ul className={styles.list}>
          {programs.map((p) => (
            <li key={p.id} className={styles.row}>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.meta}>{p.days.map((d) => d.name).join(', ')}</span>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title={`Упражнения · ${exercises?.length ?? 0}`}
      >
        {MUSCLE_GROUPS.map((m) => {
          const group = exercises?.filter((e) => e.muscle === m) ?? []
          if (!group.length) return null
          return (
            <section key={m} className={styles.group}>
              <SectionLabel>{MUSCLE_LABELS[m]}</SectionLabel>
              <ul className={styles.list}>
                {group.map((e) => (
                  <li key={e.id} className={styles.row}>
                    <span className={styles.name}>{e.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </Sheet>
    </Screen>
  )
}
