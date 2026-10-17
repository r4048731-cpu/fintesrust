import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { NoteSheet } from '../components/NoteSheet'
import { Screen } from '../components/Screen'
import { noteHeading } from '../data/repositories/notes'
import type { Note } from '../domain/types'
import styles from './NotesScreen.module.css'

/** Сколько держать полоску «Заметка удалена · Вернуть». */
const UNDO_MS = 6000

const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })

/** Заметки: поиск, добавление, правка и удаление с возможностью вернуть. */
export function NotesScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const notes = useLiveQuery(() => repos.notes.list(), [repos])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Note | 'new' | null>(null)
  const [deleted, setDeleted] = useState<Note | null>(null)

  useEffect(() => {
    if (!deleted) return
    const timer = setTimeout(() => setDeleted(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [deleted])

  const q = query.trim().toLowerCase()
  const shown = notes?.filter((n) => !q || `${n.title}\n${n.text}`.toLowerCase().includes(q))

  return (
    <Screen
      title="Заметки"
      eyebrow={notes?.length ? `Всего: ${notes.length}` : undefined}
      onBack={() => navigate(-1)}
      action={
        <Button variant="primary" size="sm" icon="plus" onClick={() => setEditing('new')}>
          Добавить
        </Button>
      }
    >
      {deleted && (
        <div className={styles.undo} role="status">
          <span>Заметка удалена</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await repos.notes.restore(deleted.id)
              setDeleted(null)
            }}
          >
            Вернуть
          </Button>
        </div>
      )}

      {notes && notes.length > 0 && (
        <input
          type="search"
          className={styles.search}
          placeholder="Поиск по заметкам"
          aria-label="Поиск по заметкам"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
        />
      )}

      {notes?.length === 0 && (
        <EmptyState title="Заметок пока нет">
          <p>Записывайте сюда всё нужное: настройки тренажёров, самочувствие, планы.</p>
        </EmptyState>
      )}
      {shown && notes && notes.length > 0 && shown.length === 0 && (
        <p className={styles.muted}>Ничего не нашлось.</p>
      )}

      {shown && shown.length > 0 && (
        <ul className={styles.list} aria-label="Заметки">
          {shown.map((n) => (
            <li key={n.id}>
              <button type="button" className={styles.row} onClick={() => setEditing(n)}>
                <span className={styles.head}>
                  <b>{noteHeading(n)}</b>
                  <span className={styles.date}>{dateFormat.format(n.updatedAt)}</span>
                </span>
                {n.title && n.text && <span className={styles.preview}>{n.text}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <NoteSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        note={editing === 'new' ? null : editing}
        onDeleted={setDeleted}
      />
    </Screen>
  )
}
