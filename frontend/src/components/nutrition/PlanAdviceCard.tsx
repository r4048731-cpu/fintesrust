import { useLiveQuery } from 'dexie-react-hooks'
import { useRepos } from '../../app/dataContext'
import { toISODate } from '../../domain/metrics'
import { addDays } from '../../domain/nutrition'
import { formatDecimal } from '../../domain/number'
import { planAdvice, SNOOZE_DAYS, type PlanAdvice } from '../../domain/planAdvice'
import { Button } from '../Button'
import styles from './PlanAdviceCard.module.css'

const kcal = (v: number) => Math.round(v).toLocaleString('ru-RU')
/** «−0,4» — со знаком, до десятых. */
const signed = (v: number) => {
  const r = Math.round(v * 10) / 10
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${formatDecimal(Math.abs(r))}`
}

function texts(a: PlanAdvice, calories: number): { title: string; text: string } {
  const change = `${kcal(a.next.calories)} ккал вместо ${kcal(calories)}`
  if (a.kind === 'recalc') {
    return {
      title: `Вес изменился на ${signed(a.toKg - a.fromKg)} кг с расчёта плана`,
      text: `Пересчитать норму под ${formatDecimal(a.toKg)} кг: ${change}.`,
    }
  }
  const slower = Math.abs(a.ratePerWeek) < Math.abs(a.targetPerWeek)
  const goal = a.targetPerWeek === 0 ? 'вес держать' : `${signed(a.targetPerWeek)} кг в неделю`
  return {
    title:
      a.targetPerWeek !== 0 && slower
        ? 'Вес идёт медленнее цели'
        : a.targetPerWeek === 0
          ? 'Вес уходит от цели «держать»'
          : 'Вес меняется быстрее цели',
    text: `За ${a.days} дн. ${Math.abs(a.ratePerWeek) < 0.1 ? 'вес почти не меняется' : `— ${signed(a.ratePerWeek)} кг в неделю`}, а цель — ${goal}. Предлагаю ${change}. Если записываете не всю еду, сначала проверьте дневник.`,
  }
}

/**
 * «Питание» → «Дневник»: подсказка к плану — пересчитать после изменения веса
 * или поправить калории по реальному темпу. Ничего не рисует, когда советовать нечего.
 */
export function PlanAdviceCard() {
  const repos = useRepos()
  const today = toISODate(new Date())
  const data = useLiveQuery(async () => {
    const [plan, basis, profile, weights] = await Promise.all([
      repos.meta.get('nutritionPlan'),
      repos.meta.get('planBasis'),
      repos.meta.get('bodyProfile'),
      repos.bodyWeights.list(),
    ])
    return { plan, basis, profile, weights }
  }, [repos])
  if (!data?.plan) return null
  const advice = planAdvice({ ...data, today })
  if (!advice) return null
  const { title, text } = texts(advice, data.plan.calories)

  async function apply() {
    await repos.meta.set('nutritionPlan', advice!.next)
    await repos.meta.set('planBasis', {
      setAt: today,
      weightKg: data!.weights.at(-1)?.weightKg ?? data!.basis?.weightKg,
    })
  }

  async function snooze() {
    await repos.meta.set('planBasis', { ...data!.basis, snoozedUntil: addDays(today, SNOOZE_DAYS) })
  }

  return (
    <section className={styles.card} aria-label="Совет по плану">
      <span className={styles.title}>{title}</span>
      <span className={styles.text}>{text}</span>
      <div className={styles.actions}>
        <Button size="sm" variant="ghost" onClick={snooze}>
          Не сейчас
        </Button>
        <Button size="sm" icon="check" variant="primary" onClick={apply}>
          {advice.kind === 'recalc' ? 'Пересчитать' : 'Применить'}
        </Button>
      </div>
    </section>
  )
}
