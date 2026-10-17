import { doneSetCount, workoutTonnage, type NewRecord } from '../domain/metrics'
import { formatDecimal, formatInteger } from '../domain/number'
import { formatDuration, formatSet } from '../domain/workout'
import { Card, SectionLabel } from './Screen'
import styles from './WorkoutReport.module.css'
import type { WorkoutReportData } from './useWorkoutReport'

const RECORD_LABEL: Record<NewRecord['kind'], string> = {
  weight: 'Вес',
  '1rm': 'Расчётный 1ПМ',
  reps: 'Повторы',
  time: 'Время',
}

function recordValue(r: NewRecord, v: number): string {
  if (r.kind === 'time') return `${Math.round(v)} с`
  if (r.kind === 'reps') return String(Math.round(v))
  return `${formatDecimal(r.kind === '1rm' ? Math.round(v * 2) / 2 : v)} кг`
}

/** Время, подходы, тоннаж, рекорды и все подходы тренировки. */
export function WorkoutReport({ data }: { data: WorkoutReportData }) {
  const { workout, exercises, records } = data
  const duration = (workout.finishedAt ?? workout.startedAt) - workout.startedAt

  return (
    <>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Время</span>
          <span className={styles.statValue}>
            {workout.manual ? '—' : formatDuration(duration)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Подходы</span>
          <span className={styles.statValue}>{doneSetCount(workout)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Тоннаж</span>
          <span className={styles.statValue}>
            {formatInteger(workoutTonnage(workout))} <small>кг</small>
          </span>
        </div>
      </div>

      {records.length > 0 ? (
        <>
          <SectionLabel>Новые рекорды</SectionLabel>
          <ul className={styles.records}>
            {records.map((r) => (
              <li key={r.exerciseId} className={styles.record}>
                <span className={styles.recordText}>
                  <span className={styles.recordName}>{exercises.get(r.exerciseId)?.name}</span>
                  <span className={styles.recordWas}>
                    {RECORD_LABEL[r.kind]}: было {recordValue(r, r.previous)}
                  </span>
                </span>
                <span className={styles.recordValue}>{recordValue(r, r.value)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.noRecords}>Рекордов в этот раз нет — ровная работа тоже прогресс.</p>
      )}

      <SectionLabel>Подходы</SectionLabel>
      <Card>
        {workout.entries.map((e, i) => {
          const ex = exercises.get(e.exerciseId)
          return (
            <div key={i} className={styles.entry}>
              <span className={styles.entryName}>
                {ex?.name ?? 'Упражнение не найдено'}
                {e.superset && <span className={styles.entryTag}> · суперсет</span>}
              </span>
              <span className={styles.entrySets}>
                {e.sets.map((s) => formatSet(s, ex?.type ?? 'weight')).join(' · ')}
              </span>
              {e.note && <span className={styles.entryNote}>{e.note}</span>}
            </div>
          )
        })}
        {workout.note && <p className={styles.note}>{workout.note}</p>}
      </Card>
    </>
  )
}
