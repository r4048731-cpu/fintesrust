import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useRepos } from '../app/dataContext'
import { useNow } from '../app/hooks/useNow'
import { useWakeLock } from '../app/hooks/useWakeLock'
import { restEndSignal, tapFeedback, unlockAudio } from '../app/signal'
import { cancelRestAlarm, scheduleRestAlarm, vibrate } from '../native/workoutAlerts'
import { Button, IconButton } from '../components/Button'
import { ExercisePicker } from '../components/ExercisePicker'
import { ExerciseInfoSheet } from '../components/ExerciseInfoSheet'
import { PlatesSheet } from '../components/PlatesSheet'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { Stepper } from '../components/Stepper'
import { formatDecimal } from '../domain/number'
import { plural } from '../domain/plural'
import { formatRest } from '../domain/programs'
import type { Exercise, Workout, WorkoutEntry, WorkoutSet } from '../domain/types'
import {
  addEntry,
  addSet,
  addWarmup,
  adjustRest,
  changeDate,
  keepDone,
  countSets,
  formatClock,
  formatSet,
  moveEntry,
  removeEntry,
  replaceEntry,
  removeLastSet,
  removeWarmup,
  warmupSets,
  workingCount,
  workWeight,
  setValue,
  SET_LIMITS,
  stopRest,
  toggleDone,
  toggleSetOnly,
  applyWeightToOpenSets,
  nextOpenSet,
  progressionHint,
  setEntryNote,
  toggleSuperset,
} from '../domain/workout'
import { linkedToNext, supersetSpan } from '../domain/superset'
import { ExerciseThumb } from '../components/ExerciseThumb'
import { formatRecordValue, RECORD_LABELS, recordFromSet, type NewRecord } from '../domain/metrics'
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

interface OpenedEntry {
  ei: number
  entry: WorkoutEntry
  ex: Exercise
  complete: boolean
}

interface Props {
  /**
   * `active` — режим «в зале» (ТЗ 2.3): активная тренировка, часы, таймер отдыха.
   * `edit` — правка завершённой тренировки из истории (ТЗ 2.4): без часов и отдыха, с датой.
   */
  mode?: 'active' | 'edit'
}

/** Сколько висит плашка нового рекорда, мс. */
const RECORD_FLASH_MS = 3500

export function WorkoutScreen({ mode = 'active' }: Props) {
  const editing = mode === 'edit'
  const { workoutId = '' } = useParams()
  const repos = useRepos()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  /** Справка по упражнению: техника или история. */
  /** Калькулятор блинов для упражнения с этим индексом. */
  const [platesFor, setPlatesFor] = useState<number | null>(null)
  const [info, setInfo] = useState<{ exercise: Exercise; tab: 'technique' | 'history' } | null>(
    null,
  )
  /** Открытое в шторке упражнение — индекс в `entries`. */
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [shownIndex, setShownIndex] = useState<number | null>(null)
  /** Индекс упражнения, которое заменяем. */
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const pending = useRef<Workout | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const signaledFor = useRef<number | null>(null)
  /** Рекорд, поставленный только что отмеченным подходом, — плашка на 3,5 с. */
  const [flash, setFlash] = useState<{ record: NewRecord; at: number } | null>(null)

  const now = useNow(250, !!workout && !editing)
  useWakeLock(!!workout && !editing)

  const exercises = useLiveQuery(async () => {
    const all = await repos.db.exercises.toArray()
    return new Map(all.map((e) => [e.id, e]))
  }, [repos])
  const weightStep = useLiveQuery(() => repos.meta.get('weightStepKg'), [repos]) ?? 2.5
  const barKg = useLiveQuery(() => repos.meta.get('barKg'), [repos]) ?? 20
  /** Завершённые тренировки — с ними сравниваем подходы, чтобы поймать рекорд. */
  const history = useLiveQuery(() => (editing ? [] : repos.workouts.listDone()), [repos, editing])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), RECORD_FLASH_MS)
    return () => clearTimeout(t)
  }, [flash])

  // Пересчёт «прошлого раза» только при смене набора упражнений, а не на каждое нажатие
  const idsKey = workout ? [...new Set(workout.entries.map((e) => e.exerciseId))].join(',') : ''
  const previous = useLiveQuery(async () => {
    // В правке истории «прошлый раз» может оказаться более поздней тренировкой — не показываем
    if (!workout || !idsKey || editing) return new Map<string, WorkoutSet[] | null>()
    const ids = idsKey.split(',')
    const sets = await Promise.all(ids.map((id) => repos.workouts.lastSets(id, workout.id)))
    return new Map(ids.map((id, i) => [id, sets[i]]))
  }, [repos, idsKey, workout?.id])
  /** Заметки к упражнениям с прошлого раза — настройка тренажёра и т. п. */
  const lastNotes = useLiveQuery(async () => {
    if (!workout || !idsKey) return new Map<string, string | null>()
    const ids = idsKey.split(',')
    const notes = await Promise.all(ids.map((id) => repos.workouts.lastNote(id, workout.id)))
    return new Map(ids.map((id, i) => [id, notes[i]]))
  }, [repos, idsKey, workout?.id])

  // Тренировка читается один раз: дальше экран — владелец правок, база только принимает их.
  useEffect(() => {
    let cancelled = false
    const load = editing
      ? repos.workouts
          .get(workoutId)
          .then((w) =>
            w && (w.status === 'done' || w.status === 'planned') && w.deletedAt === null ? w : null,
          )
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

  // Будильник телефона (Android) — сработает и при погасшем экране; «Готов» и ±15 с его переставляют.
  // При уходе с экрана не отменяем: тренировка идёт, отдых тоже.
  const restText = (() => {
    const upcoming = workout && exercises ? nextOpenSet(workout) : null
    const ex = upcoming && exercises?.get(workout!.entries[upcoming.ei].exerciseId)
    return ex ? `Дальше: ${ex.name}` : ''
  })()
  useEffect(() => {
    if (editing) return
    if (restEndsAt && restEndsAt > Date.now()) scheduleRestAlarm(restEndsAt, restText)
    else cancelRestAlarm()
  }, [restEndsAt, restText, editing])
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
  /** Запланированная тренировка (ТЗ 9.3): подходы — это план, отмечать нечего. */
  const planned = w.status === 'planned'
  const next = editing ? null : nextOpenSet(w)
  const restLeft = restEndsAt && !editing ? (restEndsAt - now) / 1000 : null
  const showRest = restLeft !== null && restLeft > -REST_OVERTIME_HIDE_SEC

  function openEntry(ei: number) {
    setConfirm(null)
    setOpenIndex(ei)
    setShownIndex(ei)
  }

  function entryAt(ei: number | null): OpenedEntry | null {
    const entry = ei !== null ? w.entries[ei] : undefined
    if (ei === null || !entry) return null
    return {
      ei,
      entry,
      ex: exerciseOf(entry.exerciseId),
      complete: !planned && entry.sets.length > 0 && entry.sets.every((s) => s.done),
    }
  }

  const opened = entryAt(openIndex)
  /** Пока шторка уезжает вниз, на ней остаётся последнее открытое упражнение. */
  const shown = opened ?? entryAt(shownIndex)

  async function finish() {
    cancelRestAlarm()
    await flush()
    await repos.workouts.finish(w.id)
    navigate(`/workout/${w.id}/summary`, { replace: true })
  }

  /** «Назад» из правки. Внесённая вручную тренировка без единого подхода не сохраняется. */
  async function leaveEdit() {
    await flush()
    if (w.manual && !planned && keepDone(w).entries.length === 0) {
      await repos.workouts.remove(w.id)
      navigate('/progress', { replace: true })
      return
    }
    navigate(planned ? '/progress' : `/history/${w.id}`)
  }

  /** «Готово» в правке: у выполненной остаются только отмеченные подходы. */
  async function saveEdit() {
    if (planned) {
      await flush()
      navigate('/progress', { replace: true })
      return
    }
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
    navigate('/progress', { replace: true })
  }

  async function discard() {
    cancelRestAlarm()
    clearTimeout(timer.current)
    pending.current = null
    await repos.workouts.discard(w.id)
    navigate('/', { replace: true })
  }

  /** Полоса отдыха: под списком закреплена внизу экрана, в шторке упражнения — внутри неё. */
  function restPanel(inSheet: boolean) {
    if (!showRest || restLeft === null) return null
    const left = restLeft
    return (
      <div
        className={[styles.rest, inSheet && styles.restInline, left <= 0 && styles.restOver]
          .filter(Boolean)
          .join(' ')}
        role="timer"
        aria-label="Отдых"
        data-pinned
      >
        <div
          className={styles.restBar}
          style={{
            width: `${Math.min(100, Math.max(0, 100 * (1 - left / (w.restTotalSec || 1))))}%`,
          }}
        />
        <div className={styles.restInner}>
          {/* Кольцо тает по мере отдыха; на последних секундах пульсирует */}
          <svg
            className={[styles.restRing, left > 0 && left <= 3 && styles.restSoon]
              .filter(Boolean)
              .join(' ')}
            viewBox="0 0 44 44"
            aria-hidden="true"
          >
            <circle cx="22" cy="22" r="18" className={styles.restTrack} />
            <circle
              cx="22"
              cy="22"
              r="18"
              pathLength={100}
              className={styles.restArc}
              style={{
                strokeDashoffset:
                  100 - Math.min(100, Math.max(0, (100 * left) / (w.restTotalSec || 1))),
              }}
            />
          </svg>
          <div className={styles.restText}>
            <span className={styles.restLabel}>{left > 0 ? 'Отдых' : 'Отдых окончен'}</span>
            <span className={styles.restTime}>
              {left > 0 ? formatClock(Math.ceil(left)) : `+${formatClock(-left)}`}
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
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        {editing ? (
          <div className={styles.topbarInner}>
            <IconButton icon="back" label="Назад" onClick={leaveEdit} />
            <div className={styles.status}>
              <span className={styles.editTitle}>
                {planned ? 'Запланированная' : w.manual ? 'Своя тренировка' : 'Правка тренировки'}
              </span>
              <span className={styles.progress}>Сохраняется сразу</span>
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
                <span className={styles.live} aria-hidden="true" />
                {formatClock((now - w.startedAt) / 1000)}
              </span>
              <span className={styles.progress}>
                {sets.done} из {sets.total} подходов
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setFinishOpen(true)}
              className={sets.total > 0 && sets.done === sets.total ? styles.ready : undefined}
            >
              Завершить
            </Button>
          </div>
        )}
        {!editing && sets.total > 0 && (
          <div className={styles.totalBar} aria-hidden="true">
            <span style={{ width: `${(100 * sets.done) / sets.total}%` }} />
          </div>
        )}
      </header>

      <main className={`${styles.body} ${showRest && openIndex === null ? styles.withRest : ''}`}>
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
            <p>Нет отмеченных подходов. Удалить тренировку?</p>
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

        {w.entries.length === 0 && <p className={styles.muted}>Добавьте упражнение.</p>}

        {w.entries.length > 0 && (
          <ol className={styles.planList} aria-label="Упражнения тренировки">
            {w.entries.map((entry, ei) => {
              const ex = exerciseOf(entry.exerciseId)
              const done = entry.sets.filter((s) => s.done).length
              const complete = !planned && done === entry.sets.length && done > 0
              const current = next?.ei === ei
              const topKg = Math.max(0, ...entry.sets.map((s) => s.weightKg))
              const count = planned
                ? `${entry.sets.length} ${plural(entry.sets.length, 'подход', 'подхода', 'подходов')}`
                : `${done} из ${entry.sets.length} подходов`
              return (
                <li
                  key={`${entry.exerciseId}-${ei}`}
                  style={
                    !planned && entry.sets.length
                      ? ({ '--done': done / entry.sets.length } as React.CSSProperties)
                      : undefined
                  }
                  className={[
                    styles.planRow,
                    current && styles.planCurrent,
                    complete && styles.planDone,
                    entry.superset && styles.planSuperset,
                    linkedToNext(w.entries, ei) && styles.planLinked,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    type="button"
                    className={styles.planJump}
                    aria-current={current ? 'step' : undefined}
                    aria-label={`${ex.name} — ${count}`}
                    onClick={() => openEntry(ei)}
                  >
                    <ExerciseThumb
                      exercise={ex}
                      mark={complete ? <Icon name="check" size={11} /> : ei + 1}
                      tone={complete ? 'done' : current ? 'current' : undefined}
                    />
                    <span className={styles.planText}>
                      <b>{ex.name}</b>
                      <span>
                        {count}
                        {ex.type !== 'time' && topKg > 0 ? ` · ${formatDecimal(topKg)} кг` : ''}
                        {entry.superset ? ' · суперсет' : ''}
                        {current ? ' · сейчас' : ''}
                      </span>
                    </span>
                  </button>
                  <IconButton
                    icon="up"
                    size="sm"
                    label={`Поднять «${ex.name}» выше`}
                    disabled={ei === 0}
                    onClick={() => change(moveEntry(w, ei, -1))}
                  />
                  <IconButton
                    icon="down"
                    size="sm"
                    label={`Опустить «${ex.name}» ниже`}
                    disabled={ei === w.entries.length - 1}
                    onClick={() => change(moveEntry(w, ei, 1))}
                  />
                  {ei < w.entries.length - 1 && (
                    <IconButton
                      icon="link"
                      size="sm"
                      aria-pressed={linkedToNext(w.entries, ei)}
                      label={
                        linkedToNext(w.entries, ei)
                          ? `Разъединить суперсет после «${ex.name}»`
                          : `Суперсет: «${ex.name}» и следующее`
                      }
                      onClick={() => change(toggleSuperset(w, ei))}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        )}

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

        {planned &&
          (confirm === 'removePlanned' ? (
            <div className={styles.confirm} role="alertdialog" aria-label="Удаление из плана">
              <p>Удалить запланированную тренировку?</p>
              <div className={styles.confirmActions}>
                <Button variant="danger" onClick={removeWorkout}>
                  Удалить
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(null)}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              className={styles.dangerText}
              onClick={() => setConfirm('removePlanned')}
            >
              Удалить из плана
            </Button>
          ))}

        {editing ? null : confirm === 'discard' ? (
          <div className={styles.confirm} role="alertdialog" aria-label="Подтверждение отмены">
            <p>Отменить тренировку? Отметки не сохранятся.</p>
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

      {openIndex === null && restPanel(false)}

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={async (ex) => {
          setPickerOpen(false)
          const entry = await repos.workouts.buildEntry(ex.id, null, w.id)
          change(addEntry(w, entry))
        }}
      />

      <ExercisePicker
        open={swapIndex !== null}
        title="Заменить на"
        similarTo={swapIndex !== null ? exerciseOf(w.entries[swapIndex].exerciseId) : undefined}
        onClose={() => setSwapIndex(null)}
        onPick={async (ex) => {
          const ei = swapIndex
          setSwapIndex(null)
          if (ei === null) return
          const entry = await repos.workouts.buildEntry(ex.id, null, w.id)
          change(replaceEntry(w, ei, entry))
        }}
      />

      {shown && (
        <Sheet
          open={opened !== null}
          onClose={() => setOpenIndex(null)}
          title={shown.ex.name}
          footer={
            <div className={styles.sheetNav}>
              <IconButton
                icon="back"
                label="Предыдущее упражнение"
                disabled={shown.ei === 0}
                onClick={() => openEntry(shown.ei - 1)}
              />
              {shown.ei < w.entries.length - 1 ? (
                <Button
                  block
                  variant={shown.complete ? 'primary' : 'secondary'}
                  onClick={() => openEntry(shown.ei + 1)}
                >
                  <span className={styles.nextName}>
                    Далее: {exerciseOf(w.entries[shown.ei + 1].exerciseId).name}
                  </span>
                  <Icon name="chevron" size={18} />
                </Button>
              ) : (
                <Button
                  block
                  variant={shown.complete ? 'primary' : 'secondary'}
                  onClick={() => setOpenIndex(null)}
                >
                  К списку упражнений
                </Button>
              )}
            </div>
          }
        >
          {(() => {
            const { entry, ei, ex } = shown
            const prev = previous?.get(entry.exerciseId)
            const timed = ex.type === 'time'
            const plan = entry.plan
            const hint = editing ? null : progressionHint(entry, prev ?? null, ex.type, weightStep)
            const openWarmup = entry.sets.some((s) => s.warmup && !s.done)
            return (
              <>
                {flash && flash.record.exerciseId === entry.exerciseId && (
                  <div key={flash.at} className={styles.recordFlash} role="status">
                    <span className={styles.recordIcon} aria-hidden="true">
                      <Icon name="trophy" size={20} />
                    </span>
                    <span>
                      <b>Новый рекорд!</b> {RECORD_LABELS[flash.record.kind]}:{' '}
                      {formatRecordValue(flash.record.kind, flash.record.value)} · было{' '}
                      {formatRecordValue(flash.record.kind, flash.record.previous)}
                    </span>
                  </div>
                )}
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
                <div className={styles.tools}>
                  <button
                    type="button"
                    className={styles.tool}
                    onClick={() => setInfo({ exercise: ex, tab: 'technique' })}
                    aria-label={`Техника: ${ex.name}`}
                  >
                    <Icon name="info" size={18} />
                    Техника
                  </button>
                  <button
                    type="button"
                    className={styles.tool}
                    onClick={() => setInfo({ exercise: ex, tab: 'history' })}
                    aria-label={`История: ${ex.name}`}
                  >
                    <Icon name="history" size={18} />
                    История
                  </button>
                  <button
                    type="button"
                    className={styles.tool}
                    onClick={() => setSwapIndex(ei)}
                    aria-label={`Заменить «${ex.name}»`}
                  >
                    <Icon name="swap" size={18} />
                    Заменить
                  </button>
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

                <div className={styles.setHead}>
                  {timed ? (
                    <span className={styles.span2} aria-hidden="true">
                      Время, с
                    </span>
                  ) : (
                    <>
                      {ex.type === 'weight' ? (
                        <button
                          type="button"
                          className={styles.platesBtn}
                          onClick={() => setPlatesFor(ei)}
                        >
                          Вес, кг <span className={styles.platesTag}>блины</span>
                        </button>
                      ) : (
                        <span aria-hidden="true">Доп. вес, кг</span>
                      )}
                      <span aria-hidden="true">Повторы</span>
                    </>
                  )}
                  <span />
                </div>

                <ol className={styles.sets} aria-label="Подходы">
                  {entry.sets.map((set, si) => (
                    <li
                      key={si}
                      className={[
                        styles.set,
                        set.done && styles.done,
                        set.warmup && styles.warm,
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
                            label={`${setName(entry.sets, si)}, время, с`}
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
                            label={`${setName(entry.sets, si)}, вес, кг`}
                            value={set.weightKg}
                            step={weightStep}
                            max={SET_LIMITS.weightKg.max}
                            onChange={(v) =>
                              change(setValue(w, ei, si, 'weightKg', v), TYPING_SAVE_MS)
                            }
                          />
                          <Stepper
                            compact
                            label={`${setName(entry.sets, si)}, повторы`}
                            value={set.reps}
                            step={1}
                            max={SET_LIMITS.reps.max}
                            onChange={(v) => change(setValue(w, ei, si, 'reps', v), TYPING_SAVE_MS)}
                          />
                        </>
                      )}
                      {planned ? (
                        <span className={styles.setNum} aria-hidden="true">
                          {si + 1}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.doneBtn}
                          aria-pressed={set.done}
                          aria-label={`${setName(entry.sets, si)} ${set.warmup ? 'выполнена' : 'выполнен'}`}
                          onClick={() => {
                            if (editing) {
                              change(toggleSetOnly(w, ei, si))
                              return
                            }
                            unlockAudio()
                            if (!set.done) tapFeedback()
                            const after = toggleDone(w, ei, si, Date.now())
                            change(after)
                            const record =
                              !set.done && history
                                ? recordFromSet(
                                    w,
                                    after,
                                    history,
                                    entry.exerciseId,
                                    (id) => exerciseOf(id).type,
                                  )
                                : null
                            if (record) {
                              setFlash({ record, at: Date.now() })
                              vibrate([30, 60, 30, 60, 140])
                            }
                            // суперсет: круг не закончен — сразу к следующему упражнению группы
                            const [a, b] = supersetSpan(after.entries, ei)
                            const upcoming = nextOpenSet(after)
                            if (
                              !set.done &&
                              a !== b &&
                              !after.restEndsAt &&
                              upcoming &&
                              upcoming.ei !== ei &&
                              upcoming.ei >= a &&
                              upcoming.ei <= b
                            ) {
                              openEntry(upcoming.ei)
                            }
                          }}
                        >
                          {set.done ? (
                            <Icon name="check" size={22} />
                          ) : set.warmup ? (
                            'Р'
                          ) : (
                            workNo(entry.sets, si)
                          )}
                        </button>
                      )}
                    </li>
                  ))}
                </ol>

                <div className={styles.entryActions}>
                  <Button
                    size="sm"
                    icon="plus"
                    onClick={() => change(addSet(w, ei, editing && !planned))}
                  >
                    Подход
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="minus"
                    aria-label="Убрать последний подход"
                    disabled={workingCount(entry) <= 1}
                    onClick={() => change(removeLastSet(w, ei))}
                  >
                    Подход
                  </Button>
                  {ex.type === 'weight' && !planned && !editing && !entry.superset && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={openWarmup ? 'close' : 'flame'}
                      disabled={
                        !openWarmup && !warmupSets(workWeight(entry), weightStep, barKg).length
                      }
                      onClick={() =>
                        change(
                          openWarmup ? removeWarmup(w, ei) : addWarmup(w, ei, weightStep, barKg),
                        )
                      }
                    >
                      Разминка
                    </Button>
                  )}
                  <span
                    className={styles.restInfo}
                    aria-label={`Отдых ${formatRest(entry.restSec)}`}
                  >
                    <Icon name="history" size={14} />
                    {formatRest(entry.restSec)}
                  </span>
                </div>

                {restPanel(true)}

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

                <label className={styles.noteField}>
                  <span className={styles.label}>Заметка к упражнению</span>
                  <textarea
                    className={`${styles.note} ${styles.noteCompact}`}
                    rows={1}
                    value={entry.note ?? ''}
                    placeholder={
                      lastNotes?.get(entry.exerciseId)
                        ? `В прошлый раз: ${lastNotes.get(entry.exerciseId)}`
                        : 'Настройка тренажёра, хват, ощущения'
                    }
                    onChange={(e) => change(setEntryNote(w, ei, e.target.value), TYPING_SAVE_MS)}
                  />
                </label>

                {confirm !== `entry:${ei}` && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.dangerText}
                    onClick={() => setConfirm(`entry:${ei}`)}
                  >
                    Убрать из тренировки
                  </Button>
                )}
              </>
            )
          })()}
        </Sheet>
      )}

      <PlatesSheet
        open={platesFor !== null}
        onClose={() => setPlatesFor(null)}
        initialKg={platesKg(w, platesFor)}
        step={weightStep}
        onApply={
          platesFor === null || planned
            ? undefined
            : (kg) => change(applyWeightToOpenSets(w, platesFor, kg))
        }
      />

      <ExerciseInfoSheet
        exercise={info?.exercise ?? null}
        tab={info?.tab ?? 'technique'}
        excludeWorkoutId={w.id}
        onTab={(tab) => info && setInfo({ ...info, tab })}
        onClose={() => setInfo(null)}
      />

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title="Завершить тренировку?">
        {sets.done === 0 ? (
          <>
            <p className={styles.muted}>Ни один подход не отмечен.</p>
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

/** Вес для калькулятора блинов: первый несделанный подход упражнения, иначе последний. */
function platesKg(w: Workout, ei: number | null): number {
  const sets = ei === null ? undefined : w.entries[ei]?.sets
  if (!sets?.length) return 20
  return (sets.find((s) => !s.done) ?? sets[sets.length - 1]).weightKg
}

/** Номер рабочего подхода: разминка в счёт не идёт. */
function workNo(sets: WorkoutSet[], si: number): number {
  return sets.slice(0, si + 1).filter((s) => !s.warmup).length
}

/** «Подход 2» или «Разминка 1» — подпись для экранного диктора. */
function setName(sets: WorkoutSet[], si: number): string {
  return sets[si]?.warmup ? `Разминка ${si + 1}` : `Подход ${workNo(sets, si)}`
}
