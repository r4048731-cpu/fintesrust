import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useRepos } from '../app/dataContext'
import { useNow } from '../app/hooks/useNow'
import { useWakeLock } from '../app/hooks/useWakeLock'
import { restEndSignal, tapFeedback, unlockAudio } from '../app/signal'
import { Button, IconButton } from '../components/Button'
import { ExercisePicker } from '../components/ExercisePicker'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { Stepper } from '../components/Stepper'
import { formatDecimal } from '../domain/number'
import { formatRest } from '../domain/programs'
import type { Exercise, Workout, WorkoutSet } from '../domain/types'
import {
  addEntry,
  addSet,
  adjustRest,
  changeDate,
  keepDone,
  countSets,
  formatClock,
  formatSet,
  moveEntry,
  removeEntry,
  removeLastSet,
  setValue,
  SET_LIMITS,
  stopRest,
  toggleDone,
  toggleSetOnly,
  applyWeightToOpenSets,
  nextOpenSet,
  progressionHint,
} from '../domain/workout'
import styles from './WorkoutScreen.module.css'

/** Правки чисел сохраняются через полсекунды после последнего нажатия, отметки — сразу. */
const TYPING_SAVE_MS = 500
/** Сколько показывать «отдых окончен», если не начат следующий подход. */
const REST_OVERTIME_HIDE_SEC = 300

const missingExercise = (id: string): Exercise => ({
  id,
  name: 'Упражнение не найдено',
  muscle: 'chest',
  type: 'weight',
  note: '',
  builtin: false,
  updatedAt: 0,
  deletedAt: 0,
})

interface Props {
  /**
   * `active` — режим «в зале» (ТЗ 2.3): активная тренировка, часы, таймер отдыха.
   * `edit` — правка завершённой тренировки из истории (ТЗ 2.4): без часов и отдыха, с датой.
   */
  mode?: 'active' | 'edit'
}

export function WorkoutScreen({ mode = 'active' }: Props) {
  const editing = mode === 'edit'
  const { workoutId = '' } = useParams()
  const repos = useRepos()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const pending = useRef<Workout | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const signaledFor = useRef<number | null>(null)

  const now = useNow(250, !!workout && !editing)
  useWakeLock(!!workout && !editing)

  const exercises = useLiveQuery(async () => {
    const all = await repos.db.exercises.toArray()
    return new Map(all.map((e) => [e.id, e]))
  }, [repos])
  const weightStep = useLiveQuery(() => repos.meta.get('weightStepKg'), [repos]) ?? 2.5

  // Пересчёт «прошлого раза» только при смене набора упражнений, а не на каждое нажатие
  const idsKey = workout ? [...new Set(workout.entries.map((e) => e.exerciseId))].join(',') : ''
  const previous = useLiveQuery(async () => {
    // В правке истории «прошлый раз» может оказаться более поздней тренировкой — не показываем
    if (!workout || !idsKey || editing) return new Map<string, WorkoutSet[] | null>()
    const ids = idsKey.split(',')
    const sets = await Promise.all(ids.map((id) => repos.workouts.lastSets(id, workout.id)))
    return new Map(ids.map((id, i) => [id, sets[i]]))
  }, [repos, idsKey, workout?.id])

  // Тренировка читается один раз: дальше экран — владелец правок, база только принимает их.
  useEffect(() => {
    let cancelled = false
    const load = editing
      ? repos.workouts
          .get(workoutId)
          .then((w) => (w && w.status === 'done' && w.deletedAt === null ? w : null))
      : repos.workouts.getActive()
    load.then((w) => !cancelled && setWorkout(w))
    return () => {
      cancelled = true
    }
  }, [repos, editing, workoutId])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const toSave = pending.current
    pending.current = null
    if (toSave) await repos.workouts.save(toSave)
  }, [repos])

  // При уходе с экрана и при сворачивании приложения несохранённое записывается сразу
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void flush()
    }
  }, [flush])

  function change(next: Workout, delay = 0) {
    setWorkout(next)
    pending.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), delay)
  }

  // Сигнал конца отдыха — один раз на каждый отдых
  const restEndsAt = workout?.restEndsAt ?? null
  useEffect(() => {
    if (restEndsAt && now >= restEndsAt && signaledFor.current !== restEndsAt) {
      signaledFor.current = restEndsAt
      restEndSignal()
    }
  }, [now, restEndsAt])

  if (workout === undefined || !exercises) return null
  if (workout === null) {
    return (
      <div className={styles.page}>
        <div className={styles.body}>
          <h1 className={styles.title}>
            {editing ? 'Тренировка не найдена' : 'Нет активной тренировки'}
          </h1>
          <p className={styles.muted}>Начните тренировку на экране «Сегодня».</p>
          <Button variant="primary" onClick={() => navigate('/')}>
            На экран «Сегодня»
          </Button>
        </div>
      </div>
    )
  }

  const w = workout
  const exerciseOf = (id: string) => exercises.get(id) ?? missingExercise(id)
  const sets = countSets(w)
  const next = editing ? null : nextOpenSet(w)
  const restLeft = restEndsAt && !editing ? (restEndsAt - now) / 1000 : null
  const showRest = restLeft !== null && restLeft > -REST_OVERTIME_HIDE_SEC

  async function finish() {
    await flush()
    await repos.workouts.finish(w.id)
    navigate(`/workout/${w.id}/summary`, { replace: true })
  }

  /** «Готово» в правке: остаются только отмеченные подходы. */
  async function saveEdit() {
    const cleaned = keepDone(w)
    if (cleaned.entries.length === 0) {
      setConfirm('empty')
      return
    }
    clearTimeout(timer.current)
    pending.current = null
    await repos.workouts.save(cleaned)
    navigate(`/history/${w.id}`, { replace: true })
  }

  async function removeWorkout() {
    clearTimeout(timer.current)
    pending.current = null
    await repos.workouts.remove(w.id)
    navigate('/history', { replace: true })
  }

  async function discard() {
    clearTimeout(timer.current)
    pending.current = null
    await repos.workouts.discard(w.id)
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        {editing ? (
          <div className={styles.topbarInner}>
            <IconButton
              icon="back"
              label="Назад к тренировке"
              onClick={async () => {
                await flush()
                navigate(`/history/${w.id}`)
              }}
            />
            <div className={styles.status}>
              <span className={styles.editTitle}>Правка тренировки</span>
              <span className={styles.progress}>Изменения сохраняются сразу</span>
            </div>
            <Button variant="primary" size="sm" onClick={saveEdit}>
              Готово
            </Button>
          </div>
        ) : (
          <div className={styles.topbarInner}>
            <IconButton icon="down" label="Свернуть тренировку" onClick={() => navigate('/')} />
            <div className={styles.status}>
              <span className={styles.clock} aria-label="Время тренировки">
                {formatClock((now - w.startedAt) / 1000)}
              </span>
              <span className={styles.progress}>
                {sets.done} из {sets.total} подходов
              </span>
            </div>
            <Button variant="primary" size="sm" onClick={() => setFinishOpen(true)}>
              Завершить
            </Button>
          </div>
        )}
      </header>

      <main className={`${styles.body} ${showRest ? styles.withRest : ''}`}>
        <input
          className={styles.nameInput}
          value={w.name}
          aria-label="Название тренировки"
          onChange={(e) => change({ ...w, name: e.target.value }, TYPING_SAVE_MS)}
          autoComplete="off"
        />

        {editing && (
          <label className={styles.noteField}>
            <span className={styles.label}>Дата</span>
            <input
              type="date"
              className={styles.dateInput}
              value={w.date}
              onChange={(e) => change(changeDate(w, e.target.value))}
            />
          </label>
        )}

        {confirm === 'empty' && (
          <div className={styles.confirm} role="alertdialog" aria-label="Нет подходов">
            <p>В тренировке не осталось отмеченных подходов. Удалить её из истории?</p>
            <div className={styles.confirmActions}>
              <Button variant="danger" onClick={removeWorkout}>
                Удалить тренировку
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Вернуться
              </Button>
            </div>
          </div>
        )}

        {w.entries.length === 0 && (
          <p className={styles.muted}>Добавьте первое упражнение — кнопка ниже.</p>
        )}

        {w.entries.map((entry, ei) => {
          const ex = exerciseOf(entry.exerciseId)
          const prev = previous?.get(entry.exerciseId)
          const timed = ex.type === 'time'
          const plan = entry.plan
          const hint = editing ? null : progressionHint(entry, prev ?? null, ex.type, weightStep)
          return (
            <section
              key={`${entry.exerciseId}-${ei}`}
              className={styles.entry}
              aria-label={ex.name}
            >
              <div className={styles.entryHead}>
                <div className={styles.entryTitle}>
                  <h2 className={styles.exName}>{ex.name}</h2>
                  <p className={styles.meta}>
                    {plan && (
                      <>
                        План: {plan.sets} ×{' '}
                        {plan.repsMin === plan.repsMax
                          ? plan.repsMax
                          : `${plan.repsMin}–${plan.repsMax}`}
                        {timed ? ' с' : ''} ·{' '}
                      </>
                    )}
                    {editing
                      ? `Отмечено ${entry.sets.filter((s) => s.done).length} из ${entry.sets.length}`
                      : prev
                        ? `Прошлый раз: ${prev.map((s) => formatSet(s, ex.type)).join(', ')}`
                        : 'Первый раз'}
                  </p>
                </div>
                <IconButton
                  icon="up"
                  label={`Поднять «${ex.name}» выше`}
                  size="sm"
                  disabled={ei === 0}
                  onClick={() => change(moveEntry(w, ei, -1))}
                />
                <IconButton
                  icon="close"
                  label={`Убрать «${ex.name}» из тренировки`}
                  size="sm"
                  onClick={() => setConfirm(`entry:${ei}`)}
                />
              </div>

              {hint && (
                <div className={styles.hint}>
                  <span className={styles.hintText}>
                    В прошлый раз все повторы сделаны — попробуйте{' '}
                    <b>{formatDecimal(hint.weightKg)} кг</b>
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => change(applyWeightToOpenSets(w, ei, hint.weightKg))}
                  >
                    Поставить
                  </Button>
                </div>
              )}

              {confirm === `entry:${ei}` && (
                <div className={styles.confirm} role="alertdialog" aria-label="Подтверждение">
                  <p>Убрать «{ex.name}» из этой тренировки?</p>
                  <div className={styles.confirmActions}>
                    <Button
                      variant="danger"
                      onClick={() => {
                        change(removeEntry(w, ei))
                        setConfirm(null)
                      }}
                    >
                      Убрать
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirm(null)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              )}

              <div className={styles.setHead} aria-hidden="true">
                {timed ? (
                  <span className={styles.span2}>Время, с</span>
                ) : (
                  <>
                    <span>{ex.type === 'bodyweight' ? 'Доп. вес, кг' : 'Вес, кг'}</span>
                    <span>Повторы</span>
                  </>
                )}
                <span />
              </div>

              <ol className={styles.sets}>
                {entry.sets.map((set, si) => (
                  <li
                    key={si}
                    className={[
                      styles.set,
                      set.done && styles.done,
                      next?.ei === ei && next.si === si && styles.next,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={next?.ei === ei && next.si === si ? 'step' : undefined}
                  >
                    {timed ? (
                      <div className={styles.span2}>
                        <Stepper
                          compact
                          label={`Подход ${si + 1}, время, с`}
                          value={set.timeSec ?? 0}
                          step={5}
                          max={SET_LIMITS.timeSec.max}
                          onChange={(v) =>
                            change(setValue(w, ei, si, 'timeSec', v), TYPING_SAVE_MS)
                          }
                        />
                      </div>
                    ) : (
                      <>
                        <Stepper
                          compact
                          decimal
                          label={`Подход ${si + 1}, вес, кг`}
                          value={set.weightKg}
                          step={weightStep}
                          max={SET_LIMITS.weightKg.max}
                          onChange={(v) =>
                            change(setValue(w, ei, si, 'weightKg', v), TYPING_SAVE_MS)
                          }
                        />
                        <Stepper
                          compact
                          label={`Подход ${si + 1}, повторы`}
                          value={set.reps}
                          step={1}
                          max={SET_LIMITS.reps.max}
                          onChange={(v) => change(setValue(w, ei, si, 'reps', v), TYPING_SAVE_MS)}
                        />
                      </>
                    )}
                    <button
                      type="button"
                      className={styles.doneBtn}
                      aria-pressed={set.done}
                      aria-label={`Подход ${si + 1} выполнен`}
                      onClick={() => {
                        if (editing) {
                          change(toggleSetOnly(w, ei, si))
                          return
                        }
                        unlockAudio()
                        if (!set.done) tapFeedback()
                        change(toggleDone(w, ei, si, Date.now()))
                      }}
                    >
                      {set.done ? <Icon name="check" size={22} /> : si + 1}
                    </button>
                  </li>
                ))}
              </ol>

              <div className={styles.entryActions}>
                <Button size="sm" icon="plus" onClick={() => change(addSet(w, ei, editing))}>
                  Подход
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="minus"
                  aria-label="Убрать последний подход"
                  disabled={entry.sets.length <= 1}
                  onClick={() => change(removeLastSet(w, ei))}
                >
                  Подход
                </Button>
                <span className={styles.restInfo}>отдых {formatRest(entry.restSec)}</span>
              </div>
            </section>
          )
        })}

        <Button icon="plus" block onClick={() => setPickerOpen(true)}>
          Упражнение
        </Button>

        <label className={styles.noteField}>
          <span className={styles.label}>Заметка к тренировке</span>
          <textarea
            className={styles.note}
            value={w.note}
            placeholder="Самочувствие, что изменить в следующий раз"
            onChange={(e) => change({ ...w, note: e.target.value }, TYPING_SAVE_MS)}
          />
        </label>

        {editing ? null : confirm === 'discard' ? (
          <div className={styles.confirm} role="alertdialog" aria-label="Подтверждение отмены">
            <p>Отменить тренировку? Все отметки этой тренировки удалятся.</p>
            <div className={styles.confirmActions}>
              <Button variant="danger" onClick={discard}>
                Отменить тренировку
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Нет
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className={styles.dangerText}
            onClick={() => setConfirm('discard')}
          >
            Отменить тренировку
          </Button>
        )}
      </main>

      {showRest && restLeft !== null && (
        <div
          className={`${styles.rest} ${restLeft <= 0 ? styles.restOver : ''}`}
          role="timer"
          aria-label="Отдых"
        >
          <div
            className={styles.restBar}
            style={{
              width: `${Math.min(100, Math.max(0, 100 * (1 - restLeft / (w.restTotalSec || 1))))}%`,
            }}
          />
          <div className={styles.restInner}>
            <div className={styles.restText}>
              <span className={styles.restLabel}>{restLeft > 0 ? 'Отдых' : 'Отдых окончен'}</span>
              <span className={styles.restTime}>
                {restLeft > 0 ? formatClock(Math.ceil(restLeft)) : `+${formatClock(-restLeft)}`}
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => change(adjustRest(w, -15, Date.now()))}
              aria-label="Отдых на 15 секунд меньше"
            >
              −15
            </Button>
            <Button
              size="sm"
              onClick={() => change(adjustRest(w, 15, Date.now()))}
              aria-label="Отдых на 15 секунд больше"
            >
              +15
            </Button>
            <Button size="sm" variant="primary" onClick={() => change(stopRest(w))}>
              Готов
            </Button>
          </div>
        </div>
      )}

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={async (ex) => {
          setPickerOpen(false)
          const entry = await repos.workouts.buildEntry(ex.id, null, w.id)
          change(addEntry(w, entry))
        }}
      />

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title="Завершить тренировку?">
        {sets.done === 0 ? (
          <>
            <p className={styles.muted}>
              Ни один подход не отмечен. Отметьте выполненные подходы галочкой или отмените
              тренировку.
            </p>
            <Button block onClick={() => setFinishOpen(false)}>
              Вернуться к тренировке
            </Button>
            <Button
              block
              variant="danger"
              onClick={() => {
                setFinishOpen(false)
                setConfirm('discard')
              }}
            >
              Отменить тренировку
            </Button>
          </>
        ) : (
          <>
            <p>
              Выполнено {sets.done} из {sets.total} подходов за{' '}
              {formatClock((now - w.startedAt) / 1000)}.
            </p>
            {sets.done < sets.total && (
              <p className={styles.muted}>Неотмеченные подходы не сохранятся.</p>
            )}
            <Button block variant="primary" onClick={finish}>
              Завершить
            </Button>
            <Button block onClick={() => setFinishOpen(false)}>
              Продолжить тренировку
            </Button>
          </>
        )}
      </Sheet>
    </div>
  )
}
