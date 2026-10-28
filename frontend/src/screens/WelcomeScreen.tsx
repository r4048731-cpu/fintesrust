import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { Chips } from '../components/Field'
import { Icon } from '../components/Icon'
import { Segmented } from '../components/Segmented'
import { Stepper } from '../components/Stepper'
import { BODY_WEIGHT_LIMITS } from '../data/repositories/bodyWeights'
import { buildProgram, type Place } from '../domain/builder'
import {
  ONBOARDING_DEFAULTS,
  onboardingBuilderInput,
  type OnboardingAnswers,
} from '../domain/onboarding'
import { plural } from '../domain/plural'
import { PROGRAM_TEMPLATES } from '../domain/templates'
import type { NutritionGoal } from '../domain/types'
import styles from './WelcomeScreen.module.css'

const GOALS: { value: NutritionGoal; label: string }[] = [
  { value: 'lose', label: 'Похудеть' },
  { value: 'maintain', label: 'Форма и сила' },
  { value: 'gain', label: 'Масса' },
]

const PLACES: { value: Place; label: string }[] = [
  { value: 'gym', label: 'В зале' },
  { value: 'home', label: 'Дома' },
]

const DAYS = ['2', '3', '4', '5', '6'].map((v) => ({ value: v, label: v }))

/** Шаблоны, которые предлагаем новичку; бокс — отдельная история, его не показываем. */
const TEMPLATES = PROGRAM_TEMPLATES.filter((t) => t.kind !== 'boxing')

const STEPS = ['Цель', 'Программа', 'Вес'] as const

/**
 * Первый запуск: три шага — цель, программа, вес — вместо пустых экранов.
 * В конце создаётся программа (подобранная или из шаблона) и записывается вес.
 */
export function WelcomeScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => repos.exercises.list(), [repos])
  const [step, setStep] = useState(0)
  const [a, setA] = useState<OnboardingAnswers>(ONBOARDING_DEFAULTS)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) =>
    setA({ ...a, [key]: value })

  const ids = new Set((exercises ?? []).map((e) => e.id))
  const built = exercises ? buildProgram(onboardingBuilderInput(a), 0, (id) => ids.has(id)) : null

  async function finish(answers: OnboardingAnswers) {
    setBusy(true)
    try {
      let programId: string | null = null
      if (answers.program === 'built' && built) {
        programId = (await repos.programs.createBuilt(built)).id
        await repos.meta.set('builderInput', onboardingBuilderInput(answers))
      } else if (answers.program !== 'later') {
        const t = PROGRAM_TEMPLATES.find((x) => x.kind === answers.program)!
        programId = (await repos.programs.create(t.name, t.kind)).id
      }
      if (programId) await repos.programs.setActive(programId)
      if (answers.weightKg) await repos.bodyWeights.record(answers.weightKg)
    } finally {
      await repos.meta.set('onboarded', true)
      navigate('/', { replace: true })
    }
  }

  async function skipAll() {
    await repos.meta.set('onboarded', true)
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span className={styles.brand}>Фитнес</span>
        <button type="button" className={styles.skip} onClick={() => void skipAll()}>
          Пропустить
        </button>
      </header>

      <ol className={styles.steps} aria-label="Шаги">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} data-done={i < step}>
            <span className={styles.dot}>{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {/* key — чтобы каждый шаг мягко проявлялся заново */}
      <section key={step} className={styles.body} aria-label={STEPS[step]}>
        {step === 0 && (
          <>
            <h1 className={styles.title}>Привет! Какая у вас цель?</h1>
            <p className={styles.lead}>Под неё подберём программу. Всё можно поменять потом.</p>
            <Segmented
              label="Цель"
              options={GOALS}
              value={a.goal}
              onChange={(v) => set('goal', v)}
            />
            <Segmented
              label="Где тренируетесь"
              options={PLACES}
              value={a.place}
              onChange={(v) => set('place', v)}
            />
            <span className={styles.label}>Тренировок в неделю</span>
            <Chips
              label="Тренировок в неделю"
              options={DAYS}
              value={String(a.daysPerWeek)}
              onChange={(v) => set('daysPerWeek', Number(v))}
            />
          </>
        )}

        {step === 1 && (
          <>
            <h1 className={styles.title}>Программа</h1>
            <p className={styles.lead}>Приложение будет предлагать её дни по кругу.</p>
            <div className={styles.options} role="radiogroup" aria-label="Программа">
              {built && (
                <Option
                  checked={a.program === 'built'}
                  onPick={() => set('program', 'built')}
                  title="Подобрать под меня"
                  badge="Советуем"
                  text={`${built.name}: ${built.days.length} ${plural(built.days.length, 'день', 'дня', 'дней')}, ${built.days.reduce((n, d) => n + d.items.length, 0)} упражнений`}
                />
              )}
              {TEMPLATES.map((t) => (
                <Option
                  key={t.kind}
                  checked={a.program === t.kind}
                  onPick={() => set('program', t.kind)}
                  title={t.name}
                  text={t.summary}
                />
              ))}
              <Option
                checked={a.program === 'later'}
                onPick={() => set('program', 'later')}
                title="Составлю сам"
                text="Пустая вкладка «Программы» — соберёте из справочника упражнений"
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className={styles.title}>Сколько вы весите?</h1>
            <p className={styles.lead}>
              Первая точка графика веса — дальше будет видно, как он меняется. Лучше взвешиваться
              утром натощак.
            </p>
            <div className={styles.weight}>
              <Stepper
                decimal
                label="Вес тела, кг"
                value={a.weightKg ?? ONBOARDING_DEFAULTS.weightKg!}
                step={0.5}
                min={BODY_WEIGHT_LIMITS.min}
                max={BODY_WEIGHT_LIMITS.max}
                onChange={(v) => set('weightKg', v)}
              />
              <span className={styles.unit}>кг</span>
            </div>
          </>
        )}
      </section>

      <footer className={styles.actions}>
        {step > 0 ? <Button onClick={() => setStep(step - 1)}>Назад</Button> : <span />}
        {step < STEPS.length - 1 ? (
          <Button iconAfter="arrow" variant="primary" onClick={() => setStep(step + 1)}>
            Дальше
          </Button>
        ) : (
          <div className={styles.finish}>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void finish({ ...a, weightKg: null })}
            >
              Без веса
            </Button>
            <Button icon="check" variant="primary" disabled={busy} onClick={() => void finish(a)}>
              Готово
            </Button>
          </div>
        )}
      </footer>
    </div>
  )
}

function Option({
  checked,
  onPick,
  title,
  text,
  badge,
}: {
  checked: boolean
  onPick: () => void
  title: string
  text: string
  badge?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={styles.option}
      onClick={onPick}
    >
      <span className={styles.radio} aria-hidden="true" />
      <span className={styles.optionText}>
        <b>
          {title}
          {badge && <span className={styles.badge}>{badge}</span>}
        </b>
        <span>{text}</span>
      </span>
    </button>
  )
}
