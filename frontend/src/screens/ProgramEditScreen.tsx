import { linkedToNext, toggleLink } from '../domain/superset'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button, IconButton } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { ExerciseInfoSheet } from '../components/ExerciseInfoSheet'
import { ExercisePicker } from '../components/ExercisePicker'
import { Screen } from '../components/Screen'
import { Stepper } from '../components/Stepper'
import {
  addDay,
  copyDay,
  formatPlan,
  mapDay,
  move,
  moveDay,
  newPlanItem,
  PLAN_LIMITS,
  removeDay,
  updatePlanItem,
} from '../domain/programs'
import { PROGRAM_KIND_LABELS } from '../domain/templates'
import type { Exercise, PlanItem, Program, ProgramDay, ProgramKind } from '../domain/types'
import { ExerciseThumb } from '../components/ExerciseThumb'
import styles from './ProgramEditScreen.module.css'

const SAVE_DELAY_MS = 400

/** Редактор программы (ТЗ 2.2). Изменения сохраняются сами через долю секунды после правки. */
export function ProgramEditScreen() {
  const { programId = '' } = useParams()
  const repos = useRepos()
  const navigate = useNavigate()
  const [program, setProgram] = useState<Program | null | undefined>(undefined)
  const [saving, setSaving] = useState<'idle' | 'pending' | 'saved'>('idle')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pickerDay, setPickerDay] = useState<string | null>(null)
  /** Карточка упражнения из дня: техника и история. */
  const [card, setCard] = useState<{ exercise: Exercise; tab: 'technique' | 'history' } | null>(
    null,
  )
  const [confirm, setConfirm] = useState<string | null>(null)
  const pending = useRef<Program | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const exercises = useLiveQuery(async () => {
    const all = await repos.db.exercises.toArray()
    return new Map(all.map((e) => [e.id, e]))
  }, [repos])
  const activeId = useLiveQuery(async () => (await repos.programs.getActive())?.id ?? null, [repos])
  const weightStep = useLiveQuery(() => repos.meta.get('weightStepKg'), [repos]) ?? 2.5

  // Программа читается один раз: дальше экран — владелец правок, база только принимает их.
  useEffect(() => {
    let cancelled = false
    repos.programs.get(programId).then((p) => !cancelled && setProgram(p ?? null))
    return () => {
      cancelled = true
    }
  }, [repos, programId])

  // Несохранённое сохраняется при уходе с экрана
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (pending.current) void repos.programs.save(pending.current)
    },
    [repos],
  )

  function change(next: Program) {
    setProgram(next)
    pending.current = next
    setSaving('pending')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const toSave = pending.current
      pending.current = null
      if (toSave) await repos.programs.save(toSave)
      setSaving('saved')
    }, SAVE_DELAY_MS)
  }

  if (program === undefined || !exercises) return null
  if (program === null) {
    return (
      <Screen title="Программа" onBack={() => navigate('/programs')}>
        <EmptyState title="Программа не найдена">
          <p>Возможно, её удалили.</p>
        </EmptyState>
      </Screen>
    )
  }

  const exerciseOf = (id: string): Exercise =>
    exercises.get(id) ?? {
      id,
      name: 'Упражнение не найдено',
      muscle: 'chest',
      type: 'weight',
      note: '',
      builtin: false,
      updatedAt: 0,
      deletedAt: 0,
    }

  function changeDay(dayId: string, fn: (day: ProgramDay) => ProgramDay) {
    change(mapDay(program!, dayId, fn))
  }

  async function duplicate() {
    if (pending.current) await repos.programs.save(pending.current)
    pending.current = null
    const copy = await repos.programs.duplicate(program!.id)
    navigate(`/programs/${copy.id}`, { replace: true })
    setProgram(copy)
  }

  async function remove() {
    clearTimeout(timer.current)
    pending.current = null
    await repos.programs.remove(program!.id)
    navigate('/programs')
  }

  return (
    <Screen
      title={program.name.trim() || 'Без названия'}
      eyebrow={
        saving === 'pending' ? 'Сохранение…' : saving === 'saved' ? 'Сохранено' : 'Программа'
      }
      onBack={() => navigate('/programs')}
    >
      <label className={styles.nameField}>
        <span className={styles.label}>Название</span>
        <input
          className={styles.nameInput}
          value={program.name}
          onChange={(e) => change({ ...program, name: e.target.value })}
          placeholder="Например, Верх/Низ"
          autoComplete="off"
        />
      </label>

      <label className={styles.nameField}>
        <span className={styles.label}>Тип программы</span>
        <select
          className={styles.nameInput}
          value={program.kind ?? 'custom'}
          onChange={(e) => change({ ...program, kind: e.target.value as ProgramKind })}
        >
          {(Object.keys(PROGRAM_KIND_LABELS) as ProgramKind[]).map((k) => (
            <option key={k} value={k}>
              {PROGRAM_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      {activeId === program.id ? (
        <p className={styles.activeNote}>
          <span className={styles.activeBadge}>Активная</span> Приложение предлагает её дни на
          экране «Сегодня».
        </p>
      ) : (
        <Button onClick={() => repos.programs.setActive(program.id)}>Сделать активной</Button>
      )}

      {program.days.map((day, di) => (
        <section key={day.id} className={styles.day} aria-label={day.name || `День ${di + 1}`}>
          <div className={styles.dayHead}>
            <input
              className={styles.dayName}
              value={day.name}
              aria-label="Название дня"
              onChange={(e) => changeDay(day.id, (d) => ({ ...d, name: e.target.value }))}
              autoComplete="off"
            />
            <IconButton
              icon="up"
              label={`Поднять «${day.name}» выше`}
              size="sm"
              disabled={di === 0}
              onClick={() => change(moveDay(program, day.id, -1))}
            />
            <IconButton
              icon="down"
              label={`Опустить «${day.name}» ниже`}
              size="sm"
              disabled={di === program.days.length - 1}
              onClick={() => change(moveDay(program, day.id, 1))}
            />
          </div>

          {day.items.length === 0 && (
            <p className={styles.emptyDay}>В этом дне пока нет упражнений.</p>
          )}

          <ol className={styles.items}>
            {day.items.map((item, ii) => {
              const ex = exerciseOf(item.exerciseId)
              const key = `${day.id}:${ii}`
              const open = expanded === key
              const setItem = (patch: Partial<PlanItem>) =>
                changeDay(day.id, (d) => ({
                  ...d,
                  items: d.items.map((it, j) =>
                    j === ii ? updatePlanItem(it, patch, ex.type) : it,
                  ),
                }))
              return (
                <li
                  key={key}
                  className={[
                    styles.item,
                    item.superset && styles.superset,
                    linkedToNext(day.items, ii) && styles.linkedNext,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className={styles.itemRow}>
                    <button
                      type="button"
                      className={styles.itemHead}
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : key)}
                    >
                      <ExerciseThumb exercise={ex} mark={ii + 1} />
                      <span className={styles.itemText}>
                        <span className={styles.itemName}>
                          {ex.name}
                          {ex.deletedAt !== null && (
                            <span className={styles.deleted}> (удалено)</span>
                          )}
                        </span>
                        <span className={styles.itemPlan}>
                          {formatPlan(item, ex.type)}
                          {item.superset ? ' · суперсет' : ''}
                        </span>
                      </span>
                      <span className={styles.itemToggle}>{open ? 'Готово' : 'Изменить'}</span>
                    </button>
                    {ii < day.items.length - 1 && (
                      <IconButton
                        icon="link"
                        size="sm"
                        aria-pressed={linkedToNext(day.items, ii)}
                        label={
                          linkedToNext(day.items, ii)
                            ? `Разъединить суперсет после «${ex.name}»`
                            : `Суперсет: «${ex.name}» и следующее`
                        }
                        onClick={() =>
                          changeDay(day.id, (d) => ({ ...d, items: toggleLink(d.items, ii) }))
                        }
                      />
                    )}
                    <IconButton
                      icon="info"
                      size="sm"
                      label={`Об упражнении «${ex.name}»`}
                      onClick={() => setCard({ exercise: ex, tab: 'technique' })}
                    />
                  </div>

                  {open && (
                    <div className={styles.editor}>
                      <div className={styles.grid}>
                        <Field label="Подходы">
                          <Stepper
                            label="Подходы"
                            value={item.sets}
                            step={1}
                            min={PLAN_LIMITS.sets.min}
                            max={PLAN_LIMITS.sets.max}
                            onChange={(sets) => setItem({ sets })}
                          />
                        </Field>
                        {ex.type !== 'time' ? (
                          <Field label={ex.type === 'bodyweight' ? 'Доп. вес, кг' : 'Вес, кг'}>
                            <Stepper
                              label={ex.type === 'bodyweight' ? 'Доп. вес, кг' : 'Вес, кг'}
                              value={item.weightKg}
                              step={weightStep}
                              max={PLAN_LIMITS.weightKg.max}
                              decimal
                              onChange={(weightKg) => setItem({ weightKg })}
                            />
                          </Field>
                        ) : (
                          <span />
                        )}
                        <Field label={ex.type === 'time' ? 'Время от, с' : 'Повторы от'}>
                          <Stepper
                            label={ex.type === 'time' ? 'Время от, с' : 'Повторы от'}
                            value={item.repsMin}
                            step={ex.type === 'time' ? 5 : 1}
                            min={1}
                            max={
                              ex.type === 'time' ? PLAN_LIMITS.timeSec.max : PLAN_LIMITS.reps.max
                            }
                            onChange={(repsMin) => setItem({ repsMin })}
                          />
                        </Field>
                        <Field label={ex.type === 'time' ? 'до, с' : 'до'}>
                          <Stepper
                            label={ex.type === 'time' ? 'Время до, с' : 'Повторы до'}
                            value={item.repsMax}
                            step={ex.type === 'time' ? 5 : 1}
                            min={1}
                            max={
                              ex.type === 'time' ? PLAN_LIMITS.timeSec.max : PLAN_LIMITS.reps.max
                            }
                            onChange={(repsMax) => setItem({ repsMax })}
                          />
                        </Field>
                        <Field label="Отдых, с">
                          <Stepper
                            label="Отдых, с"
                            value={item.restSec}
                            step={15}
                            max={PLAN_LIMITS.restSec.max}
                            onChange={(restSec) => setItem({ restSec })}
                          />
                        </Field>
                      </div>
                      <div className={styles.itemActions}>
                        <IconButton
                          icon="up"
                          label="Выше"
                          size="sm"
                          variant="secondary"
                          disabled={ii === 0}
                          onClick={() => {
                            changeDay(day.id, (d) => ({ ...d, items: move(d.items, ii, -1) }))
                            setExpanded(`${day.id}:${ii - 1}`)
                          }}
                        />
                        <IconButton
                          icon="down"
                          label="Ниже"
                          size="sm"
                          variant="secondary"
                          disabled={ii === day.items.length - 1}
                          onClick={() => {
                            changeDay(day.id, (d) => ({ ...d, items: move(d.items, ii, 1) }))
                            setExpanded(`${day.id}:${ii + 1}`)
                          }}
                        />
                        <Button
                          size="sm"
                          variant="danger"
                          className={styles.pushRight}
                          onClick={() => {
                            changeDay(day.id, (d) => ({
                              ...d,
                              items: d.items.filter((_, j) => j !== ii),
                            }))
                            setExpanded(null)
                          }}
                        >
                          Убрать из дня
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>

          <Button icon="plus" block onClick={() => setPickerDay(day.id)}>
            Упражнение
          </Button>

          {confirm === `day:${day.id}` ? (
            <div
              className={styles.confirm}
              role="alertdialog"
              aria-label="Подтверждение удаления дня"
            >
              <p>Удалить «{day.name}»?</p>
              <div className={styles.confirmActions}>
                <Button
                  variant="danger"
                  onClick={() => {
                    change(removeDay(program, day.id))
                    setConfirm(null)
                  }}
                >
                  Удалить день
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(null)}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.dayActions}>
              <Button size="sm" variant="ghost" onClick={() => change(copyDay(program, day.id))}>
                Копировать день
              </Button>
              {program.days.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={styles.dangerText}
                  onClick={() =>
                    day.items.length
                      ? setConfirm(`day:${day.id}`)
                      : change(removeDay(program, day.id))
                  }
                >
                  Удалить день
                </Button>
              )}
            </div>
          )}
        </section>
      ))}

      <Button icon="plus" block onClick={() => change(addDay(program))}>
        Добавить день
      </Button>

      <div className={styles.footer}>
        <Button onClick={duplicate}>Копировать программу</Button>
        {confirm === 'program' ? (
          <div
            className={styles.confirm}
            role="alertdialog"
            aria-label="Подтверждение удаления программы"
          >
            <p>Удалить «{program.name}»? История останется.</p>
            <div className={styles.confirmActions}>
              <Button variant="danger" onClick={remove}>
                Удалить
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirm('program')}>
            Удалить программу
          </Button>
        )}
      </div>

      <ExerciseInfoSheet
        exercise={card?.exercise ?? null}
        tab={card?.tab ?? 'technique'}
        onTab={(tab) => card && setCard({ ...card, tab })}
        onClose={() => setCard(null)}
        addToProgram={false}
      />

      <ExercisePicker
        open={pickerDay !== null}
        onClose={() => setPickerDay(null)}
        onPick={(ex) => {
          const dayId = pickerDay
          setPickerDay(null)
          if (!dayId) return
          const day = program.days.find((d) => d.id === dayId)
          changeDay(dayId, (d) => ({ ...d, items: [...d.items, newPlanItem(ex)] }))
          if (day) setExpanded(`${dayId}:${day.items.length}`)
        }}
      />
    </Screen>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  )
}
