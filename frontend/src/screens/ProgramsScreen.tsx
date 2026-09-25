import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { plural } from '../domain/plural'
import styles from './ProgramsScreen.module.css'

export function ProgramsScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const programs = useLiveQuery(() => repos.programs.list(), [repos])
  const activeId = useLiveQuery(async () => (await repos.programs.getActive())?.id ?? null, [repos])

  async function create() {
    const program = await repos.programs.create()
    navigate(`/programs/${program.id}`)
  }

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
        <EmptyState
          title="Программ пока нет"
          action={
            <Button variant="primary" icon="plus" onClick={create}>
              Создать программу
            </Button>
          }
        >
          <p>
            Программа состоит из дней, например «Верх» и «Низ». В каждом дне — упражнения с
            подходами, повторениями, весом и отдыхом.
          </p>
        </EmptyState>
      )}
      {programs && programs.length > 0 && (
        <>
          <ul className={styles.list} aria-label="Программы">
            {programs.map((p) => {
              const exercises = p.days.reduce((n, d) => n + d.items.length, 0)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => navigate(`/programs/${p.id}`)}
                  >
                    <span className={styles.text}>
                      <span className={styles.name}>
                        {p.name}
                        {p.id === activeId && <span className={styles.active}>активная</span>}
                      </span>
                      <span className={styles.meta}>
                        {p.days.length} {plural(p.days.length, 'день', 'дня', 'дней')} · {exercises}{' '}
                        {plural(exercises, 'упражнение', 'упражнения', 'упражнений')}
                      </span>
                      <span className={styles.meta}>{p.days.map((d) => d.name).join(' · ')}</span>
                    </span>
                    <span className={styles.chevron}>
                      <Icon name="chevron" size={20} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <Button variant="primary" icon="plus" block onClick={create}>
            Новая программа
          </Button>
        </>
      )}
    </Screen>
  )
}
