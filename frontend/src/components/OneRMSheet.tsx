import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import { estimate1RM } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import { ONE_RM_RELIABLE_REPS, ONE_RM_ZONE_LABELS, oneRMTable } from '../domain/oneRM'
import { SET_LIMITS } from '../domain/workout'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'
import styles from './OneRMSheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  /** С какого подхода начать — обычно лучший по истории упражнения. */
  initial?: { weightKg: number; reps: number }
  /** Название упражнения в подзаголовке; без него калькулятор общий. */
  exerciseName?: string
}

const DEFAULT_SET = { weightKg: 60, reps: 5 }

/** Калькулятор 1ПМ: вес и повторы подхода → максимум на один раз и рабочие веса в процентах. */
export function OneRMSheet({ open, onClose, initial, exerciseName }: Props) {
  const start = initial && initial.weightKg > 0 && initial.reps > 0 ? initial : DEFAULT_SET
  return (
    <Sheet open={open} onClose={onClose} title="Калькулятор 1ПМ">
      {open && (
        <OneRMForm
          key={`${start.weightKg}x${start.reps}`}
          start={start}
          exerciseName={exerciseName}
        />
      )}
    </Sheet>
  )
}

function OneRMForm({
  start,
  exerciseName,
}: {
  start: { weightKg: number; reps: number }
  exerciseName?: string
}) {
  const repos = useRepos()
  const step = useLiveQuery(() => repos.meta.get('weightStepKg'), [repos]) ?? 2.5
  const [weightKg, setWeightKg] = useState(start.weightKg)
  const [reps, setReps] = useState(start.reps)
  const oneRM = estimate1RM(weightKg, reps)
  const rows = oneRMTable(oneRM, step)

  return (
    <div className={styles.body}>
      <p className={styles.intro}>
        {exerciseName ? (
          <>
            <b>{exerciseName}</b> — по лучшему подходу. Поменяйте вес и повторы, чтобы посчитать
            другой.
          </>
        ) : (
          <>Вес и повторы подхода, сделанного до отказа или почти до отказа.</>
        )}
      </p>
      <div className={styles.inputs}>
        <div className={styles.field}>
          <span className={styles.label}>Вес, кг</span>
          <Stepper
            decimal
            label="Вес, кг"
            value={weightKg}
            step={step}
            max={SET_LIMITS.weightKg.max}
            onChange={setWeightKg}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Повторы</span>
          <Stepper
            label="Повторы"
            value={reps}
            step={1}
            min={1}
            max={SET_LIMITS.reps.max}
            onChange={setReps}
          />
        </div>
      </div>

      <p className={styles.result} role="status">
        <span className={styles.label}>Максимум на 1 раз</span>
        <b>{oneRM > 0 ? `${formatDecimal(Math.round(oneRM * 10) / 10)} кг` : '—'}</b>
        {reps > ONE_RM_RELIABLE_REPS && (
          <span className={styles.warn}>
            При {reps} повторах формула завышает максимум — точнее всего подход на 3–10 раз.
          </span>
        )}
      </p>

      {rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">%</th>
              <th scope="col">Вес</th>
              <th scope="col">Повторы</th>
              <th scope="col">Зачем</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.percent} data-zone={r.zone}>
                <td>{r.percent}%</td>
                <td className={styles.kg}>{formatDecimal(r.weightKg)} кг</td>
                <td>{r.reps === 1 ? '1' : `≈${r.reps}`}</td>
                <td className={styles.zone}>{ONE_RM_ZONE_LABELS[r.zone]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className={styles.note}>
        Формула Эпли, вес округлён до шага {formatDecimal(step)} кг. Повторы — примерно сколько
        выйдет до отказа; для рабочих подходов оставляйте 1–2 в запасе.
      </p>
    </div>
  )
}
