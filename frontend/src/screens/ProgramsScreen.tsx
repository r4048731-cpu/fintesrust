import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Screen } from '../components/Screen'
import styles from './ProgramsScreen.module.css'

export function ProgramsScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const programs = useLiveQuery(() => repos.programs.list(), [repos])

  return (
    <Screen
      title="Программы"
      action={
        <Button size="sm" onClick={() => navigate('/programs/exercises')}>
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
    </Screen>
  )
}
