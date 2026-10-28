import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import { toISODate } from '../domain/metrics'
import { caloriesFromMacros, roundNutrients } from '../domain/nutrition'
import { formatDecimal, parseDecimal } from '../domain/number'
import type { Nutrients } from '../domain/types'
import { Button } from './Button'
import { TextField } from './Field'
import { Sheet } from './Sheet'
import styles from './MealSheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  plan: Nutrients | null
  /** Открыть «Расчёт КБЖУ» вместо ручного ввода. */
  onCalc: () => void
}

const FIELDS: { key: keyof Nutrients; label: string }[] = [
  { key: 'calories', label: 'Ккал' },
  { key: 'protein', label: 'Белки, г' },
  { key: 'fat', label: 'Жиры, г' },
  { key: 'carbs', label: 'Углев., г' },
]

/** Дневной план: калории обязательны, Б/Ж/У — по желанию (пусто — без цели). */
export function NutritionPlanSheet({ open, onClose, plan, onCalc }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="План на день">
      {open && <PlanForm plan={plan} onClose={onClose} onCalc={onCalc} />}
    </Sheet>
  )
}

function PlanForm({
  plan,
  onClose,
  onCalc,
}: {
  plan: Nutrients | null
  onClose: () => void
  onCalc: () => void
}) {
  const repos = useRepos()
  const [t, setT] = useState<Record<keyof Nutrients, string>>(() => ({
    calories: plan ? String(plan.calories) : '',
    protein: plan?.protein ? formatDecimal(plan.protein) : '',
    fat: plan?.fat ? formatDecimal(plan.fat) : '',
    carbs: plan?.carbs ? formatDecimal(plan.carbs) : '',
  }))
  const [error, setError] = useState<string | null>(null)

  const value = (k: keyof Nutrients) => (t[k].trim() === '' ? 0 : parseDecimal(t[k]))
  const protein = value('protein') ?? 0
  const fat = value('fat') ?? 0
  const carbs = value('carbs') ?? 0
  const byMacros = protein && fat && carbs ? caloriesFromMacros({ protein, fat, carbs }) : 0

  async function save() {
    const calories = parseDecimal(t.calories)
    if (calories === null || calories < 500 || calories > 10000) {
      return setError('Калории — от 500 до 10 000')
    }
    const macros = (['protein', 'fat', 'carbs'] as const).map(value)
    if (macros.some((v) => v === null || v < 0 || v > 1000)) {
      return setError('Белки, жиры и углеводы — от 0 до 1000 г или пусто')
    }
    const [p, f, c] = macros as number[]
    await repos.meta.set(
      'nutritionPlan',
      roundNutrients({ calories, protein: p, fat: f, carbs: c }),
    )
    // введён руками — веса расчёта нет, но темп веса считается с этого дня
    await repos.meta.set('planBasis', { setAt: toISODate(new Date()) })
    onClose()
  }

  async function clear() {
    await repos.meta.set('nutritionPlan', null)
    await repos.meta.set('planBasis', null)
    onClose()
  }

  return (
    <div className={styles.form}>
      <p className={styles.hint}>
        Не знаете цифры?{' '}
        <button type="button" className={styles.link} onClick={onCalc}>
          Рассчитать по весу, росту и возрасту
        </button>
      </p>
      <div className={styles.grid}>
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={t[f.key]}
            inputMode="decimal"
            autoComplete="off"
            onChange={(e) => setT({ ...t, [f.key]: e.target.value })}
          />
        ))}
      </div>
      {byMacros > 0 && <p className={styles.hint}>По Б/Ж/У выходит ≈ {byMacros} ккал.</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button icon="check" variant="primary" block onClick={save}>
        Сохранить
      </Button>
      {plan && (
        <Button variant="ghost" block onClick={clear}>
          Убрать план
        </Button>
      )}
    </div>
  )
}
