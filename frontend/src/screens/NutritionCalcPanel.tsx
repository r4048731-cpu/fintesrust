import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { TextField } from '../components/Field'
import { Card } from '../components/Screen'
import { Segmented } from '../components/Segmented'
import { toISODate } from '../domain/metrics'
import { estimatePlan, type PlanEstimate } from '../domain/nutrition'
import { formatDecimal, parseDecimal } from '../domain/number'
import type { Activity, BodyProfile, NutritionGoal, Sex } from '../domain/types'
import styles from './NutritionCalcPanel.module.css'

const SEXES: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Мужчина' },
  { value: 'female', label: 'Женщина' },
]

/** Уровни активности по порядку на шкале: заголовок и пояснение, как выбрать. */
const ACTIVITIES: { value: Activity; title: string; text: string }[] = [
  {
    value: 'none',
    title: 'Почти без движения',
    text: 'Сидячая работа, тренировок нет или они редкие, мало ходите пешком.',
  },
  {
    value: 'light',
    title: '1–2 тренировки в неделю',
    text: 'Тренируетесь пару раз в неделю или много ходите, но в остальное время двигаетесь мало.',
  },
  {
    value: 'moderate',
    title: '3–4 тренировки в неделю',
    text: 'Регулярно тренируетесь 3–4 раза в неделю и в обычной жизни хотя бы умеренно двигаетесь. Подходит большинству без тяжёлой физической работы.',
  },
  {
    value: 'high',
    title: '5–6 тренировок в неделю',
    text: 'Тренируетесь почти каждый день или сочетаете тренировки с активной работой на ногах.',
  },
  {
    value: 'extreme',
    title: 'Тяжёлая работа и спорт',
    text: 'Физическая работа плюс тренировки, или две тренировки в день.',
  },
]

const GOALS: { value: NutritionGoal; label: string }[] = [
  { value: 'lose', label: 'Похудеть' },
  { value: 'maintain', label: 'Держать' },
  { value: 'gain', label: 'Набрать' },
]

const GOAL_HINT: Record<NutritionGoal, string> = {
  lose: 'Минус ≈ 0,5 кг в неделю — без резкого дефицита.',
  maintain: 'Вес стоит на месте.',
  gain: 'Плюс ≈ 0,25 кг в неделю — набор без лишнего жира.',
}

const LIMITS = {
  age: { min: 14, max: 90 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
}

const kcal = (v: number) => Math.round(v).toLocaleString('ru-RU')

/** «Расчёт КБЖУ» во вкладке «Питание»: норма по параметрам, по кнопке становится планом. */
export function NutritionCalcPanel({ onSaved }: { onSaved: () => void }) {
  const repos = useRepos()
  const profile = useLiveQuery(() => repos.meta.get('bodyProfile'), [repos])
  const lastWeight = useLiveQuery(
    async () => (await repos.bodyWeights.list()).at(-1)?.weightKg ?? null,
    [repos],
  )
  if (profile === undefined || lastWeight === undefined) return null
  return <CalcForm profile={profile} lastWeight={lastWeight} onSaved={onSaved} />
}

function CalcForm({
  profile,
  lastWeight,
  onSaved,
}: {
  profile: BodyProfile | null
  lastWeight: number | null
  onSaved: () => void
}) {
  const repos = useRepos()
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'male')
  const [age, setAge] = useState(profile ? String(profile.age) : '')
  const [height, setHeight] = useState(profile ? String(profile.heightCm) : '')
  const [weight, setWeight] = useState(lastWeight ? formatDecimal(lastWeight) : '')
  const [target, setTarget] = useState(profile?.targetKg ? formatDecimal(profile.targetKg) : '')
  /** Вес, с которого посчитан результат, — запоминается вместе с планом. */
  const [resultKg, setResultKg] = useState<number | null>(null)
  const [activity, setActivity] = useState<Activity>(profile?.activity ?? 'moderate')
  const [goal, setGoal] = useState<NutritionGoal>(profile?.goal ?? 'maintain')
  const [result, setResult] = useState<PlanEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)

  const level = ACTIVITIES.findIndex((a) => a.value === activity)
  const current = ACTIVITIES[level]

  /** Любая правка параметров сбрасывает старый результат — чтобы не сохранить устаревший. */
  const edited =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setResult(null)
    }

  async function calculate() {
    const a = parseDecimal(age)
    const h = parseDecimal(height)
    const w = parseDecimal(weight)
    const bad = (v: number | null, { min, max }: { min: number; max: number }) =>
      v === null || v < min || v > max
    if (bad(w, LIMITS.weightKg)) {
      return setError(`Вес — от ${LIMITS.weightKg.min} до ${LIMITS.weightKg.max} кг`)
    }
    if (bad(h, LIMITS.heightCm)) {
      return setError(`Рост — от ${LIMITS.heightCm.min} до ${LIMITS.heightCm.max} см`)
    }
    if (bad(a, LIMITS.age)) return setError(`Возраст — от ${LIMITS.age.min} до ${LIMITS.age.max}`)
    const t = target.trim() === '' ? null : parseDecimal(target)
    if (target.trim() !== '' && bad(t, LIMITS.weightKg)) {
      return setError(
        `Целевой вес — от ${LIMITS.weightKg.min} до ${LIMITS.weightKg.max} кг или пусто`,
      )
    }
    setError(null)
    const next: BodyProfile = {
      sex,
      age: Math.round(a!),
      heightCm: Math.round(h!),
      activity,
      goal,
      ...(t ? { targetKg: Math.round(t * 10) / 10 } : {}),
    }
    setResult(estimatePlan(next, w!))
    setResultKg(w!)
    await repos.meta.set('bodyProfile', next)
  }

  async function save() {
    if (!result) return
    const { calories, protein, fat, carbs } = result
    await repos.meta.set('nutritionPlan', { calories, protein, fat, carbs })
    await repos.meta.set('planBasis', {
      setAt: toISODate(new Date()),
      weightKg: resultKg ?? undefined,
    })
    onSaved()
  }

  return (
    <>
      <section className={styles.block} aria-label="Расскажите о себе">
        <h2 className={styles.heading}>Расскажите о себе</h2>
        <div className={styles.fields}>
          <TextField
            label="Вес, кг"
            value={weight}
            inputMode="decimal"
            autoComplete="off"
            onChange={(e) => edited(setWeight)(e.target.value)}
          />
          <TextField
            label="Рост, см"
            value={height}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => edited(setHeight)(e.target.value)}
          />
          <TextField
            label="Возраст"
            value={age}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => edited(setAge)(e.target.value)}
          />
        </div>
        <Segmented label="Пол" options={SEXES} value={sex} onChange={edited(setSex)} />
      </section>

      <section className={styles.block} aria-label="Уровень активности">
        <h2 className={styles.heading}>Уровень активности</h2>
        <div className={styles.scale} role="radiogroup" aria-label="Уровень активности">
          <span className={styles.track} aria-hidden="true">
            <span style={{ width: `${(level / (ACTIVITIES.length - 1)) * 100}%` }} />
          </span>
          {ACTIVITIES.map((a, i) => (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={a.value === activity}
              aria-label={`${i + 1}: ${a.title}`}
              className={styles.step}
              onClick={() => edited(setActivity)(a.value)}
            >
              <span className={styles.dot} />
              <span className={styles.num}>{i + 1}</span>
            </button>
          ))}
        </div>
        <Card>
          <h3 className={styles.levelTitle}>{current.title}</h3>
          <p className={styles.levelText}>{current.text}</p>
        </Card>
      </section>

      <section className={styles.block} aria-label="Цель">
        <h2 className={styles.heading}>Цель</h2>
        <Segmented label="Цель" options={GOALS} value={goal} onChange={edited(setGoal)} />
        <p className={styles.hint}>{GOAL_HINT[goal]}</p>
        {goal === 'lose' && (
          <TextField
            label="Целевой вес, кг — необязательно"
            value={target}
            inputMode="decimal"
            autoComplete="off"
            onChange={(e) => edited(setTarget)(e.target.value)}
          />
        )}
      </section>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button iconAfter="arrow" variant="primary" block onClick={calculate}>
        Рассчитать
      </Button>

      {result && (
        <Card framed>
          <section className={styles.result} aria-label="Ваша норма">
            <span className={styles.label}>Ваша норма в день</span>
            <p className={styles.big}>
              {kcal(result.calories)} <span>ккал</span>
            </p>
            <div className={styles.macros}>
              <Macro label="Белки" value={result.protein} />
              <Macro label="Жиры" value={result.fat} />
              <Macro label="Углеводы" value={result.carbs} />
            </div>
            <p className={styles.hint} role="status">
              Обмен в покое ≈ {kcal(result.bmr)} ккал, с активностью ≈ {kcal(result.maintenance)}{' '}
              ккал.
              {resultKg !== null && result.proteinKg !== resultKg && (
                <> Белок — от {formatDecimal(result.proteinKg)} кг, а не от текущего веса.</>
              )}
            </p>
            <Button icon="check" variant="primary" block onClick={save}>
              Сделать планом
            </Button>
          </section>
        </Card>
      )}
    </>
  )
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.macro}>
      <span className={styles.label}>{label}</span>
      <b>
        {value} <span>г</span>
      </b>
    </div>
  )
}
