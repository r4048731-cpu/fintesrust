import { useState, type FormEvent } from 'react'
import { useRepos } from '../app/dataContext'
import { NOTE_LIMITS, NoteValidationError } from '../data/repositories/notes'
import type { Note } from '../domain/types'
import { Button } from './Button'
import { TextAreaField, TextField } from './Field'
import { Sheet } from './Sheet'
import styles from './NoteSheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  /** Что правим; null — новая заметка. */
  note: Note | null
  /** Заметку удалили — экран показывает «Вернуть». Без него кнопки удаления нет. */
  onDeleted?: (note: Note) => void
}

/** Новая заметка и правка: заголовок, текст, удаление. */
export function NoteSheet({ open, onClose, note, onDeleted }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={note ? 'Заметка' : 'Новая заметка'} tall>
      {open && (
        <NoteForm key={note?.id ?? 'new'} note={note} onClose={onClose} onDeleted={onDeleted} />
      )}
    </Sheet>
  )
}

function NoteForm({ note, onClose, onDeleted }: Omit<Props, 'open'>) {
  const repos = useRepos()
  const [title, setTitle] = useState(note?.title ?? '')
  const [text, setText] = useState(note?.text ?? '')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (note) await repos.notes.update(note.id, { title, text })
      else await repos.notes.add({ title, text })
      onClose()
    } catch (err) {
      setError(err instanceof NoteValidationError ? err.message : 'Не удалось сохранить')
    }
  }

  async function remove() {
    if (!note) return
    await repos.notes.remove(note.id)
    onClose()
    onDeleted?.(note)
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <TextField
        label="Заголовок"
        value={title}
        maxLength={NOTE_LIMITS.title}
        placeholder="Необязательно"
        autoComplete="off"
        onChange={(e) => {
          setTitle(e.target.value)
          setError(null)
        }}
        error={error}
      />
      <TextAreaField
        label="Текст"
        className={styles.text}
        value={text}
        placeholder="Что хотите запомнить"
        onChange={(e) => {
          setText(e.target.value)
          setError(null)
        }}
      />
      <Button type="submit" icon="check" variant="primary" block>
        {note ? 'Сохранить' : 'Добавить заметку'}
      </Button>
      {note && onDeleted && (
        <Button variant="danger" block onClick={remove}>
          Удалить заметку
        </Button>
      )}
    </form>
  )
}
