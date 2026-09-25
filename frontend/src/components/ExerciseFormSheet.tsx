import { useState, type FormEvent } from 'react'
import { useRepos } from '../app/dataContext'
import { ExerciseValidationError } from '../data/repositories/exercises'
import {
  EXERCISE_TYPE_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  type Exercise,
  type ExerciseType,
  type MuscleGroup,
} from '../domain/types'
import { Button } from './Button'
import { SelectField, TextAreaField, TextField } from './Field'
import { Sheet } from './Sheet'
import styles from './ExerciseFormSheet.module.css'

const MUSCLE_OPTIONS = MUSCLE_GROUPS.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }))
const TYPE_OPTIONS = (Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((t) => ({
  value: t,
  label: EXERCISE_TYPE_LABELS[t],
}))

interface Props {
  open: boolean
  onClose: () => void
  /** Упражнение для правки; без него шторка создаёт новое. */
  exercise?: Exercise | null
  /** Начальные значения нового упражнения, например текст из поиска. */
  defaults?: { name?: string; muscle?: MuscleGroup }
  onSaved?: (exercise: Exercise) => void
}

/** Создание и правка упражнения. Форма пересоздаётся при каждом открытии. */
export function ExerciseFormSheet(props: Props) {
  const title = props.exercise ? 'Упражнение' : 'Новое упражнение'
  return (
    <Sheet open={props.open} onClose={props.onClose} title={title}>
      {props.open && <ExerciseForm key={props.exercise?.id ?? 'new'} {...props} />}
    </Sheet>
  )
}

function ExerciseForm({ exercise, defaults, onClose, onSaved }: Props) {
  const repos = useRepos()
  const [name, setName] = useState(exercise?.name ?? defaults?.name ?? '')
  const [muscle, setMuscle] = useState<MuscleGroup>(exercise?.muscle ?? defaults?.muscle ?? 'chest')
  const [type, setType] = useState<ExerciseType>(exercise?.type ?? 'weight')
  const [note, setNote] = useState(exercise?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const input = { name, muscle, type, note }
      const saved = exercise
        ? await repos.exercises.update(exercise.id, input)
        : await repos.exercises.create(input)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(
        err instanceof ExerciseValidationError
          ? err.message
          : 'Не удалось сохранить. Попробуйте ещё раз.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!exercise) return
    await repos.exercises.remove(exercise.id)
    onClose()
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <TextField
        label="Название"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
        error={error}
        placeholder="Например, жим в Смите"
        autoComplete="off"
        enterKeyHint="done"
      />
      <SelectField
        label="Группа мышц"
        options={MUSCLE_OPTIONS}
        value={muscle}
        onChange={(e) => setMuscle(e.target.value as MuscleGroup)}
      />
      <SelectField
        label="Тип"
        options={TYPE_OPTIONS}
        value={type}
        onChange={(e) => setType(e.target.value as ExerciseType)}
      />
      <TextAreaField
        label="Заметка"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Техника, настройки тренажёра, хват"
      />
      <Button type="submit" variant="primary" block disabled={busy}>
        {exercise ? 'Сохранить' : 'Добавить в справочник'}
      </Button>

      {exercise &&
        (confirmDelete ? (
          <div className={styles.confirm} role="alertdialog" aria-label="Подтверждение удаления">
            <p>Удалить «{exercise.name}»? В сохранённых тренировках и программах оно останется.</p>
            <div className={styles.confirmActions}>
              <Button variant="danger" onClick={remove}>
                Удалить
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" block onClick={() => setConfirmDelete(true)}>
            Удалить упражнение
          </Button>
        ))}
    </form>
  )
}
