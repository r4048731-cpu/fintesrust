import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { useRepos } from '../app/dataContext'
import {
  autoKind,
  BUILDER_DEFAULTS,
  BUILDER_LIMITS,
  buildProgram,
  type BuilderInput,
  type BuilderKind,
  type BuiltProgram,
} from '../domain/builder'
import { formatDecimal } from '../domain/number'
import type { Exercise, PlanItem } from '../domain/types'
import { Button } from './Button'
import { Segmented } from './Segmented'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'
import styles from './ProgramBuilderSheet.module.css'

const KINDS: { value: BuilderKind; label: string }[] = [
  { value: 'auto', label: 'Подобрать' },
  { value: 'fullbody', label: 'Фулбади' },
  { value: 'upperlower', label: 'Верх / Низ' },
  { value: 'ppl', label: 'Тяни / Толкай / Ноги' },
  { value: 'split', label: 'Сплит' },
]

const KIND_LABEL: Record<BuiltProgram['kind'], string> = {
  fullbody: 'фулбади',
  upperlower: 'верх / низ',
  ppl: 'тяни / толкай / ноги',
  split: 'сплит',
}

/** «3 × 8–10 · 52,5 кг», «3 × 30–60 с», «10–15 мин». */
function planText(item: PlanItem, exercise: Exercise | undefined): string {
  const range = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`)
  if (exercise?.type === 'time') {
    if (item.sets === 1 && item.repsMin >= 60)
      return `${range(item.repsMin / 60, item.repsMax / 60)} мин`
    return `${item.sets} × ${range(item.repsMin, item.repsMax)} с`
  }
  const reps = `${item.sets} × ${range(item.repsMin, item.repsMax)}`
  return item.weightKg ? `${reps} · ${formatDecimal(item.weightKg)} кг` : reps
}

interface Props {
  open: boolean
  onClose: () => void
  /** Программа сохранена — открыть её в редакторе. */
  onSaved: (programId: string) => void
}

/**
 * «Подобрать программу»: пол, возраст, рост, вес, место, опыт, цель, тренировок в неделю и тип.
 * Ответы запоминаются; первый раз подставляются из расчёта питания и последнего веса.
 */
export function ProgramBuilderSheet({ open, onClose, onSaved }: Props) {
  const repos = useRepos()
  const saved = useLiveQuery(() => repos.meta.get('builderInput'), [repos])
  const profile = useLiveQuery(() => repos.meta.get('bodyProfile'), [repos])
  const weights = useLiveQuery(() => repos.bodyWeights.list(), [repos])
  const exercises = useLiveQuery(() => repos.exercises.list(), [repos])
  // свои правки; пока их нет — последние ответы или данные из профиля и последнего веса
  const [edited, setEdited] = useState<BuilderInput | null>(null)
  const [variant, setVariant] = useState(0)
  const [preview, setPreview] = useState(false)
  const loaded = saved !== undefined && profile !== undefined && weights !== undefined
  const last = weights?.at(-1)?.weightKg
  const input: BuilderInput | null =
    edited ??
    (loaded
      ? {
          ...BUILDER_DEFAULTS,
          ...(profile && {
            sex: profile.sex,
            age: profile.age,
            heightCm: profile.heightCm,
            goal: profile.goal,
          }),
          ...(last && { weightKg: last }),
          ...saved,
        }
      : null)

  function close() {
    setPreview(false)
    setVariant(0)
    setEdited(null)
    onClose()
  }

  const byId = new Map((exercises ?? []).map((e) => [e.id, e]))
  const set = <K extends keyof BuilderInput>(key: K, value: BuilderInput[K]) =>
    input && setEdited({ ...input, [key]: value })
  const built = input && preview ? buildProgram(input, variant, (id) => byId.has(id)) : null

  async function save() {
    if (!built || !input) return
    const program = await repos.programs.createBuilt(built)
    close()
    onSaved(program.id)
  }

  async function compose() {
    if (!input) return
    await repos.meta.set('builderInput', input)
    setVariant(0)
    setPreview(true)
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={built ? built.name : 'Подобрать программу'}
      tall
      footer={
        built ? (
          <div className={styles.actions}>
            <Button onClick={() => setPreview(false)}>Параметры</Button>
            <Button variant="primary" block onClick={() => void save()}>
              Сохранить
            </Button>
          </div>
        ) : (
          <Button variant="primary" block disabled={!input} onClick={() => void compose()}>
            Составить программу
          </Button>
        )
      }
    >
      {input && !built && <Form input={input} set={set} />}
      {built && (
        <div className={styles.preview}>
          <ul className={styles.notes} aria-label="Почему так">
            {built.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          {built.days.map((d) => (
            <section key={d.name} className={styles.day} aria-label={d.name}>
              <h3>{d.name}</h3>
              <ol>
                {d.items.map((item) => {
                  const e = byId.get(item.exerciseId)
                  return (
                    <li key={item.exerciseId}>
                      <span>{e?.name ?? 'Упражнение'}</span>
                      <b>{planText(item, e)}</b>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
          <Button icon="swap" block onClick={() => setVariant((v) => v + 1)}>
            Другой вариант упражнений
          </Button>
          <p className={styles.hint}>
            После сохранения программа откроется в редакторе: любое упражнение, подходы и вес можно
            поменять. Не подошла — подберите заново с другими параметрами.
          </p>
        </div>
      )}
    </Sheet>
  )
}

function Form({
  input,
  set,
}: {
  input: BuilderInput
  set: <K extends keyof BuilderInput>(key: K, value: BuilderInput[K]) => void
}) {
  const L = BUILDER_LIMITS
  return (
    <div className={styles.form}>
      <Row label="Пол">
        <Segmented
          label="Пол"
          value={input.sex}
          onChange={(v) => set('sex', v)}
          options={[
            { value: 'male', label: 'Мужской' },
            { value: 'female', label: 'Женский' },
          ]}
        />
      </Row>
      <div className={styles.numbers}>
        <Row label="Возраст">
          <Stepper
            label="Возраст, лет"
            value={input.age}
            step={1}
            min={L.age.min}
            max={L.age.max}
            onChange={(v) => set('age', v)}
          />
        </Row>
        <Row label="Рост, см">
          <Stepper
            label="Рост, см"
            value={input.heightCm}
            step={1}
            min={L.heightCm.min}
            max={L.heightCm.max}
            onChange={(v) => set('heightCm', v)}
          />
        </Row>
        <Row label="Вес, кг">
          <Stepper
            label="Вес, кг"
            value={input.weightKg}
            step={0.5}
            decimal
            min={L.weightKg.min}
            max={L.weightKg.max}
            onChange={(v) => set('weightKg', v)}
          />
        </Row>
      </div>
      <Row label="Где тренируетесь">
        <Segmented
          label="Где тренируетесь"
          value={input.place}
          onChange={(v) => set('place', v)}
          options={[
            { value: 'gym', label: 'В зале' },
            { value: 'home', label: 'Дома' },
          ]}
        />
        {input.place === 'home' && (
          <div className={styles.chips} role="group" aria-label="Что есть дома">
            <Chip on={input.dumbbells} onClick={() => set('dumbbells', !input.dumbbells)}>
              Гантели
            </Chip>
            <Chip on={input.pullUpBar} onClick={() => set('pullUpBar', !input.pullUpBar)}>
              Турник
            </Chip>
          </div>
        )}
      </Row>
      <Row label="Опыт">
        <Segmented
          label="Опыт"
          value={input.level}
          onChange={(v) => set('level', v)}
          options={[
            { value: 'beginner', label: 'Новичок' },
            { value: 'intermediate', label: 'Полгода–2 года' },
            { value: 'advanced', label: 'Больше 2 лет' },
          ]}
        />
      </Row>
      <Row label="Цель">
        <Segmented
          label="Цель"
          value={input.goal}
          onChange={(v) => set('goal', v)}
          options={[
            { value: 'lose', label: 'Похудеть' },
            { value: 'maintain', label: 'Форма и сила' },
            { value: 'gain', label: 'Масса' },
          ]}
        />
      </Row>
      <Row label="Тренировок в неделю">
        <Segmented
          label="Тренировок в неделю"
          value={String(input.daysPerWeek)}
          onChange={(v) => set('daysPerWeek', Number(v))}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))}
        />
      </Row>
      <Row label="Тип программы">
        <div className={styles.chips} role="group" aria-label="Тип программы">
          {KINDS.map((k) => (
            <Chip key={k.value} on={input.kind === k.value} onClick={() => set('kind', k.value)}>
              {k.label}
            </Chip>
          ))}
        </div>
        {input.kind === 'auto' && (
          <p className={styles.hint}>
            Для {input.daysPerWeek} тренировок в неделю —{' '}
            {KIND_LABEL[autoKind(input.daysPerWeek, input.level)]}.
          </p>
        )}
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={styles.chip} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  )
}
