import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useRepos } from '../app/dataContext'
import { exerciseHistory, parseISODate, personalRecords } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import { bodyImage, MUSCLE_NAMES, muscleWork, type MuscleWork } from '../domain/muscles'
import { newPlanItem } from '../domain/programs'
import {
  techniqueCues,
  techniqueImages,
  techniqueSearchUrl,
  type TechniqueImages,
} from '../domain/technique'
import { EXERCISE_TYPE_LABELS, MUSCLE_LABELS, type Exercise } from '../domain/types'
import { formatSet } from '../domain/workout'
import { Button } from './Button'
import { formatLongDateInline } from './dates'
import { ExerciseFormSheet } from './ExerciseFormSheet'
import { Segmented } from './Segmented'
import { Sheet } from './Sheet'
import styles from './ExerciseInfoSheet.module.css'

type Tab = 'technique' | 'history'

const TABS: { value: Tab; label: string }[] = [
  { value: 'technique', label: 'Техника' },
  { value: 'history', label: 'История' },
]

/** Сколько прошлых тренировок показывать. */
const HISTORY_ROWS = 10

interface Props {
  exercise: Exercise | null
  tab: Tab
  onTab: (tab: Tab) => void
  onClose: () => void
  /** Тренировка, которую сейчас правят: в её же истории не показываем. */
  excludeWorkoutId?: string
  /** Кнопка «В программу». Не нужна там, где программу уже правят на экране. */
  addToProgram?: boolean
}

/**
 * Карточка упражнения — одна и та же из справочника, программы и тренировки:
 * техника, история с рекордами, правка и добавление в программу.
 */
export function ExerciseInfoSheet({
  exercise,
  tab,
  onTab,
  onClose,
  excludeWorkoutId,
  addToProgram = true,
}: Props) {
  const repos = useRepos()
  // Читаем из базы, чтобы карточка сразу показывала правки из шторки «Изменить»
  const live = useLiveQuery(
    async () => (exercise ? ((await repos.db.exercises.get(exercise.id)) ?? null) : null),
    [repos, exercise?.id],
  )
  const shown = (live?.id === exercise?.id ? live : null) ?? exercise
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  /** Сообщение «Добавлено…» — только для того упражнения, к которому оно относится. */
  const [addedFor, setAddedFor] = useState<{ id: string; text: string } | null>(null)
  const added = addedFor && addedFor.id === exercise?.id ? addedFor.text : null
  // Упражнение удалили из шторки «Изменить» — карточка закрывается
  const deleted = !!live && live.deletedAt !== null
  useEffect(() => {
    if (deleted) onClose()
  }, [deleted, onClose])

  return (
    <>
      <Sheet
        open={exercise !== null && !deleted}
        onClose={onClose}
        title={shown?.name ?? ''}
        footer={
          shown && (
            <>
              <Button onClick={() => setEditing(true)}>Изменить</Button>
              {addToProgram && (
                <Button icon="plus" variant="primary" onClick={() => setPicking(true)}>
                  В программу
                </Button>
              )}
            </>
          )
        }
      >
        {shown && (
          <div className={styles.body}>
            <p className={styles.muted}>
              {MUSCLE_LABELS[shown.muscle]} · {EXERCISE_TYPE_LABELS[shown.type]}
            </p>
            {added && (
              <p className={styles.added} role="status">
                {added}
              </p>
            )}
            <Segmented label="Справка" options={TABS} value={tab} onChange={onTab} />
            {tab === 'technique' ? (
              <Technique exercise={shown} />
            ) : (
              <History exercise={shown} excludeWorkoutId={excludeWorkoutId} />
            )}
          </div>
        )}
      </Sheet>
      <ExerciseFormSheet open={editing} onClose={() => setEditing(false)} exercise={shown} />
      {shown && (
        <ProgramDayPicker
          open={picking}
          onClose={() => setPicking(false)}
          onPick={async (programId, dayId) => {
            setPicking(false)
            const program = await repos.programs.get(programId)
            const day = program?.days.find((d) => d.id === dayId)
            if (!program || !day) return
            day.items.push(newPlanItem(shown))
            await repos.programs.save(program)
            setAddedFor({ id: shown.id, text: `Добавлено: ${program.name} → ${day.name}` })
          }}
        />
      )}
    </>
  )
}

/** Выбор программы и дня, куда добавить упражнение. */
function ProgramDayPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (programId: string, dayId: string) => void
}) {
  const repos = useRepos()
  const programs = useLiveQuery(() => repos.programs.list(), [repos])
  return (
    <Sheet open={open} onClose={onClose} title="В какой день добавить">
      {programs?.length === 0 && (
        <p className={styles.muted}>Программ пока нет — создайте её во вкладке «Программы».</p>
      )}
      {programs?.map((p) => (
        <section key={p.id} className={styles.pickGroup} aria-label={p.name}>
          <span className={styles.label}>{p.name}</span>
          <ul className={styles.pickList}>
            {p.days.map((d) => (
              <li key={d.id}>
                <button type="button" className={styles.pickRow} onClick={() => onPick(p.id, d.id)}>
                  <b>{d.name}</b>
                  <span className={styles.muted}>
                    {d.items.length ? `${d.items.length} упр.` : 'пусто'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Sheet>
  )
}

function Technique({ exercise }: { exercise: Exercise }) {
  const cues = techniqueCues(exercise)
  const images = techniqueImages(exercise)
  const work = muscleWork(exercise)
  return (
    <>
      {images && <TechniqueImagesView images={images} name={exercise.name} />}
      {work && <MuscleMap work={work} />}
      {cues.length > 0 && <h3 className={styles.howTo}>Как правильно делать</h3>}
      {cues.length > 0 ? (
        <ul className={styles.cues} aria-label="Ключевые моменты">
          {cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>
          Для своего упражнения подсказок нет — допишите технику в заметку через «Изменить».
        </p>
      )}
      {exercise.note && (
        <div className={styles.note}>
          <span className={styles.label}>Ваша заметка</span>
          <p>{exercise.note}</p>
        </div>
      )}
      <a
        className={styles.video}
        href={techniqueSearchUrl(exercise)}
        target="_blank"
        rel="noreferrer"
      >
        Найти в Яндексе
      </a>
    </>
  )
}

/** Два положения рядом — начало и конец движения. Картинки лежат в приложении, интернет не нужен. */
function TechniqueImagesView({ images, name }: { images: TechniqueImages; name: string }) {
  return (
    <figure className={styles.frames} aria-label={`Техника: ${name}`}>
      <div
        className={[
          styles[
            images.kind === 'drawing' ? 'drawings' : images.kind === 'boxing' ? 'boxing' : 'photos'
          ],
          images.frames.length === 1 && styles.single,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {images.frames.map((src, i) => {
          const single = images.frames.length === 1
          return (
            <div key={src} className={styles.frame}>
              <img
                src={src}
                alt={single ? name : i === 0 ? 'Начало движения' : 'Конец движения'}
                decoding="async"
              />
              {!single && <span className={styles.step}>{i === 0 ? 'Начало' : 'Конец'}</span>}
            </div>
          )
        })}
      </div>
      <figcaption className={styles.credit}>{images.credit}</figcaption>
    </figure>
  )
}

/**
 * Схема тела спереди и сзади: основные мышцы красные, вспомогательные оранжевые.
 * Слои накладываются фонами поверх рисунка тела — все одной ширины, поэтому совпадают.
 */
function MuscleMap({ work }: { work: MuscleWork }) {
  const names = (list: typeof work.main) => list.map((k) => MUSCLE_NAMES[k]).join(', ')
  return (
    <figure className={styles.muscles} aria-label="Какие мышцы работают">
      <div className={styles.bodies}>
        {(['front', 'back'] as const).map((side) => (
          <div
            key={side}
            className={styles.body}
            role="img"
            aria-label={side === 'front' ? 'Спереди' : 'Сзади'}
            style={{
              backgroundImage: [...work.layers[side], bodyImage(side)]
                .map((src) => `url("${src}")`)
                .join(', '),
            }}
          />
        ))}
      </div>
      <figcaption className={styles.legend}>
        <span>
          <i className={styles.dotMain} /> Основные: {names(work.main)}
        </span>
        {work.secondary.length > 0 && (
          <span>
            <i className={styles.dotSecondary} /> Помогают: {names(work.secondary)}
          </span>
        )}
        <span className={styles.credit}>Схема: Termininja, Викисклад, и wger — CC BY-SA 3.0</span>
      </figcaption>
    </figure>
  )
}

function History({
  exercise,
  excludeWorkoutId,
}: {
  exercise: Exercise
  excludeWorkoutId?: string
}) {
  const repos = useRepos()
  const all = useLiveQuery(async () => {
    const done = (await repos.workouts.listDone()).filter((w) => w.id !== excludeWorkoutId)
    return exerciseHistory(done, exercise.id)
  }, [repos, exercise.id, excludeWorkoutId])
  if (!all) return null
  if (all.length === 0) {
    return <p className={styles.muted}>Это упражнение ещё не выполнялось.</p>
  }
  const sessions = [...all].reverse().slice(0, HISTORY_ROWS)
  const records = personalRecords(all)!
  const tiles: [string, string][] =
    exercise.type === 'time'
      ? [['Дольше всего', `${records.maxTimeSec} с`]]
      : exercise.type === 'bodyweight'
        ? [
            ['Больше всего', `${records.maxReps} повт.`],
            ...(records.maxWeightKg > 0
              ? ([['Доп. вес', `${formatDecimal(records.maxWeightKg)} кг`]] as [string, string][])
              : []),
          ]
        : [
            ['Макс. вес', `${formatDecimal(records.maxWeightKg)} кг`],
            ['Расч. 1ПМ', `${formatDecimal(Math.round(records.max1RM))} кг`],
          ]
  return (
    <>
      <div className={styles.records} role="group" aria-label="Рекорды">
        {tiles.map(([label, value]) => (
          <div key={label} className={styles.record}>
            <span className={styles.label}>{label}</span>
            <b>{value}</b>
          </div>
        ))}
        <div className={styles.record}>
          <span className={styles.label}>Тренировок</span>
          <b>{all.length}</b>
        </div>
      </div>
      <ul className={styles.history} aria-label="Прошлые тренировки">
        {sessions.map((s) => (
          <li key={s.workoutId}>
            <span className={styles.date}>{formatLongDateInline(parseISODate(s.date))}</span>
            <span>{s.sets.map((set) => formatSet(set, exercise.type)).join(', ')}</span>
            {exercise.type === 'weight' && s.workingWeightKg > 0 && (
              <span className={styles.muted}>рабочий {formatDecimal(s.workingWeightKg)} кг</span>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
