import type { ID, Note } from '../../domain/types'
import { newId } from '../../domain/id'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'

export const NOTE_LIMITS = { title: 120, text: 20000 } as const

export interface NoteInput {
  title: string
  text: string
}

/** Ошибка ввода: текст показывается пользователю как есть. */
export class NoteValidationError extends Error {}

function normalize(input: NoteInput): NoteInput {
  const title = input.title.trim()
  const text = input.text.trim()
  if (!title && !text) throw new NoteValidationError('Заметка пустая — напишите хоть что-нибудь')
  if (title.length > NOTE_LIMITS.title) {
    throw new NoteValidationError(`Заголовок длиннее ${NOTE_LIMITS.title} символов`)
  }
  if (text.length > NOTE_LIMITS.text) throw new NoteValidationError('Слишком длинная заметка')
  return { title, text }
}

/** Что показать заголовком: сам заголовок или первая строка текста. */
export function noteHeading(note: Pick<Note, 'title' | 'text'>): string {
  return note.title || note.text.split('\n')[0]
}

export function notesRepo(db: FitnessDB, clock: Clock) {
  return {
    /** Живые заметки, недавно изменённые сверху. */
    async list(): Promise<Note[]> {
      const rows = await db.notes.toArray()
      return rows.filter((n) => n.deletedAt === null).sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async add(input: NoteInput): Promise<Note> {
      const now = clock()
      const note: Note = {
        id: newId(),
        ...normalize(input),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await db.notes.add(note)
      return note
    },

    async update(id: ID, input: NoteInput): Promise<void> {
      await db.notes.update(id, { ...normalize(input), updatedAt: clock() })
    },

    /** Мягкое удаление — заметку можно вернуть кнопкой «Вернуть». */
    async remove(id: ID): Promise<void> {
      await db.notes.update(id, { deletedAt: clock(), updatedAt: clock() })
    },

    async restore(id: ID): Promise<void> {
      await db.notes.update(id, { deletedAt: null, updatedAt: clock() })
    },
  }
}
