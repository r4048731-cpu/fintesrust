import { useState, type ReactNode } from 'react'
import { filterExercises } from '../domain/exercises'
import {
  EXERCISE_TYPE_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  type Exercise,
  type MuscleGroup,
} from '../domain/types'
import { Chips } from './Field'
import { Icon } from './Icon'
import { ExerciseThumb } from './ExerciseThumb'
import { gearLabel } from '../domain/similar'
import styles from './ExerciseBrowser.module.css'

type MuscleFilter = MuscleGroup | 'all'

const MUSCLE_OPTIONS: { value: MuscleFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  ...MUSCLE_GROUPS.map((m) => ({ value: m, label: MUSCLE_LABELS[m] })),
]

interface Props {
  exercises: Exercise[]
  onSelect: (exercise: Exercise) => void
  /** `edit` — стрелка «открыть», `add` — плюс «добавить». */
  mode: 'edit' | 'add'
  /** Что показать, когда поиск ничего не нашёл; получает введённый текст. */
  renderEmpty?: (query: string) => ReactNode
  /** Похожие упражнения — сверху, пока нет поиска и фильтра. */
  suggested?: Exercise[]
}

/**
 * Поиск, фильтр по группе мышц и список упражнений. Без фильтров список разбит
 * по группам мышц, с фильтром — один общий список по алфавиту.
 */
export function ExerciseBrowser({ exercises, onSelect, mode, renderEmpty, suggested }: Props) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleFilter>('all')
  const list = filterExercises(exercises, { query, muscle: muscle === 'all' ? null : muscle })
  const grouped = !query.trim() && muscle === 'all'

  const row = (e: Exercise, gear = false) => (
    <li key={e.id}>
      <button type="button" className={styles.row} onClick={() => onSelect(e)}>
        <ExerciseThumb exercise={e} />
        <span className={styles.text}>
          <span className={styles.name}>
            {e.name}
            {!e.builtin && <span className={styles.own}>своё</span>}
          </span>
          <span className={styles.meta}>
            {grouped && !gear ? '' : `${MUSCLE_LABELS[e.muscle]} · `}
            {(gear && gearLabel(e)) || EXERCISE_TYPE_LABELS[e.type]}
            {e.note && ` · ${e.note}`}
          </span>
        </span>
        <span className={mode === 'add' ? styles.add : styles.chevron}>
          <Icon name={mode === 'add' ? 'plus' : 'chevron'} size={20} />
        </span>
      </button>
    </li>
  )

  return (
    <div className={styles.browser}>
      <div className={styles.controls}>
        <input
          type="search"
          className={styles.search}
          placeholder="Поиск по названию"
          aria-label="Поиск по названию"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
        />
        <Chips label="Группа мышц" options={MUSCLE_OPTIONS} value={muscle} onChange={setMuscle} />
      </div>

      {list.length === 0 ? (
        <div className={styles.empty}>
          <p>Ничего не найдено.</p>
          {renderEmpty?.(query.trim())}
        </div>
      ) : grouped ? (
        <>
          {suggested && suggested.length > 0 && (
            <section className={styles.group} aria-label="Похожие">
              <h3 className={styles.groupTitle}>Похожие</h3>
              <ul className={styles.list}>{suggested.map((e) => row(e, true))}</ul>
            </section>
          )}
          {MUSCLE_GROUPS.map((m) => {
            const group = list.filter((e) => e.muscle === m)
            if (!group.length) return null
            return (
              <section key={m} className={styles.group} aria-label={MUSCLE_LABELS[m]}>
                <h3 className={styles.groupTitle}>
                  {MUSCLE_LABELS[m]} <span className={styles.count}>{group.length}</span>
                </h3>
                <ul className={styles.list}>{group.map((e) => row(e))}</ul>
              </section>
            )
          })}
        </>
      ) : (
        <ul className={styles.list} aria-label="Найденные упражнения">
          {list.map((e) => row(e))}
        </ul>
      )}
    </div>
  )
}
