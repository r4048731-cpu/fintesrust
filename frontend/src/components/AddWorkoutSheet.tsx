import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { toISODate } from '../domain/metrics'
import { Button } from './Button'
import { SelectField } from './Field'
import { Sheet } from './Sheet'
import styles from './AddWorkoutSheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * «Добавить тренировку» в «Истории» (ТЗ 9.3): дата и откуда взять упражнения.
 * Дальше открывается экран правки, где подходы можно поменять.
 */
export function AddWorkoutSheet({ open, onClose }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Добавить тренировку">
      {open && <AddWorkoutForm onClose={onClose} />}
    </Sheet>
  )
}

function AddWorkoutForm({ onClose }: { onClose: () => void }) {
  const repos = useRepos()
  const navigate = useNavigate()
  const today = toISODate(new Date())
  const [date, setDate] = useState(today)
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const programs = useLiveQuery(() => repos.programs.list(), [repos])

  const options = [
    { value: '', label: 'Пустая — упражнения добавлю сам' },
    ...(programs ?? []).flatMap((p) =>
      p.days.map((d) => ({ value: `${p.id}|${d.id}`, label: `${p.name} · ${d.name}` })),
    ),
  ]
  const planned = date > today

  async function create() {
    setBusy(true)
    const [programId, dayId] = source.split('|')
    const w = await repos.workouts.createManual({
      date,
      from: source ? { programId, dayId } : null,
      today,
    })
    onClose()
    navigate(`/history/${w.id}/edit`)
  }

  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>Дата</span>
        <input
          type="date"
          className={styles.date}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </label>
      <SelectField
        label="Упражнения"
        options={options}
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <p className={styles.hint}>
        {planned
          ? 'Будущая дата — тренировка запланируется и появится на «Сегодня» в этот день.'
          : 'Тренировка сразу попадёт в историю, подходы можно поправить.'}
      </p>
      <Button variant="primary" block disabled={busy} onClick={create}>
        {planned ? 'Запланировать' : 'Добавить'}
      </Button>
    </div>
  )
}
