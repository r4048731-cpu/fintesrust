import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button, IconButton } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { ProgramBuilderSheet } from '../components/ProgramBuilderSheet'
import { Screen } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { plural } from '../domain/plural'
import { PROGRAM_KIND_LABELS, PROGRAM_TEMPLATES } from '../domain/templates'
import type { ProgramKind } from '../domain/types'
import frame from '../components/frame.module.css'
import styles from './ProgramsScreen.module.css'

export function ProgramsScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const programs = useLiveQuery(() => repos.programs.list(), [repos])
  const activeId = useLiveQuery(async () => (await repos.programs.getActive())?.id ?? null, [repos])

  const [chooseOpen, setChooseOpen] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const create = () => setChooseOpen(true)

  async function createOf(kind: ProgramKind, name: string) {
    setChooseOpen(false)
    const program = await repos.programs.create(name, kind)
    navigate(`/programs/${program.id}`)
  }

  const openBuilder = () => {
    setChooseOpen(false)
    setBuilderOpen(true)
  }

  return (
    <Screen
      title="Программы"
      action={
        // Справочник и заметки — значками у заголовка, а не отдельной строкой кнопок
        <div className={styles.links}>
          <IconButton
            icon="dumbbell"
            variant="secondary"
            label="Упражнения"
            onClick={() => navigate('/programs/exercises')}
          />
          <IconButton
            icon="note"
            variant="secondary"
            label="Заметки"
            onClick={() => navigate('/notes')}
          />
        </div>
      }
    >
      {programs?.length === 0 && (
        <EmptyState
          title="Программ пока нет"
          icon="programs"
          action={
            <div className={styles.emptyActions}>
              <Button variant="primary" icon="ai" onClick={openBuilder}>
                Подобрать под меня
              </Button>
              <Button icon="plus" onClick={create}>
                Создать программу
              </Button>
            </div>
          }
        >
          <p>Выберите готовую программу, соберите свою или подберите под себя.</p>
        </EmptyState>
      )}
      {programs && programs.length > 0 && (
        <>
          <ul className={`${styles.list} ${frame.frame}`} aria-label="Программы">
            {programs.map((p) => {
              const exercises = p.days.reduce((n, d) => n + d.items.length, 0)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => navigate(`/programs/${p.id}`)}
                  >
                    <span
                      className={`${styles.badge} ${p.id === activeId ? styles.badgeActive : ''}`}
                      aria-hidden="true"
                    >
                      <Icon name="programs" size={20} />
                    </span>
                    <span className={styles.text}>
                      <span className={styles.name}>
                        {p.name}
                        {p.id === activeId && <span className={styles.active}>активная</span>}
                        {p.kind &&
                          p.kind !== 'custom' &&
                          PROGRAM_KIND_LABELS[p.kind] !== p.name && (
                            <span className={styles.kind}>{PROGRAM_KIND_LABELS[p.kind]}</span>
                          )}
                      </span>
                      <span className={styles.meta}>
                        {p.days.length} {plural(p.days.length, 'день', 'дня', 'дней')} · {exercises}{' '}
                        {plural(exercises, 'упражнение', 'упражнения', 'упражнений')}
                      </span>
                      <span className={styles.dayChips}>
                        {p.days.map((d) => (
                          <span key={d.id} className={styles.dayChip}>
                            {d.name}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className={styles.chevron}>
                      <Icon name="chevron" size={20} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className={styles.emptyActions}>
            <Button variant="primary" icon="plus" block onClick={create}>
              Новая программа
            </Button>
            <Button icon="ai" block onClick={openBuilder}>
              Подобрать под меня
            </Button>
          </div>
        </>
      )}
      <Sheet open={chooseOpen} onClose={() => setChooseOpen(false)} title="Тип программы">
        <p className={styles.sheetHint}>Дни и упражнения потом можно поменять.</p>
        <ul className={styles.templates}>
          <li>
            <button
              type="button"
              className={`${styles.template} ${styles.builder}`}
              onClick={openBuilder}
            >
              <span className={styles.templateName}>Подобрать под меня</span>
              <span className={styles.summary}>
                По полу, возрасту, росту и весу, месту, опыту и цели — с подходами и стартовыми
                весами.
              </span>
            </button>
          </li>
          {PROGRAM_TEMPLATES.map((t) => (
            <li key={t.kind}>
              <button
                type="button"
                className={styles.template}
                onClick={() => createOf(t.kind, t.name)}
              >
                <span className={styles.templateName}>{t.name}</span>
                <span className={styles.summary}>{t.summary}</span>
                <span className={styles.templateDays}>
                  {t.days.map((d) => `${d.name} (${d.items.length})`).join(', ')}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={styles.template}
              onClick={() => createOf('custom', 'Новая программа')}
            >
              <span className={styles.templateName}>Своя программа</span>
              <span className={styles.summary}>
                Один пустой день — дни и упражнения добавите сами.
              </span>
            </button>
          </li>
        </ul>
      </Sheet>
      <ProgramBuilderSheet
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSaved={(id) => navigate(`/programs/${id}`)}
      />
    </Screen>
  )
}
