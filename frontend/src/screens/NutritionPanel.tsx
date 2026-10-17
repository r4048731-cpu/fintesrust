import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import { BotLinks } from '../components/BotLinks'
import { Button, IconButton } from '../components/Button'
import { LineChart } from '../components/charts/LineChart'
import { MealSheet } from '../components/MealSheet'
import { NutritionPlanSheet } from '../components/NutritionPlanSheet'
import { Icon } from '../components/Icon'
import { Card, SectionLabel } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { parseISODate, toISODate } from '../domain/metrics'
import { addDays, dailyTotals, sumNutrients } from '../domain/nutrition'
import { formatDecimal } from '../domain/number'
import type { Meal, Nutrients } from '../domain/types'
import styles from './NutritionPanel.module.css'

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

const MACROS: {
  key: Exclude<keyof Nutrients, 'calories'>
  label: string
  short: string
  /** Ккал в грамме. */
  kcalPerGram: number
}[] = [
  { key: 'protein', label: 'Белки', short: 'Б', kcalPerGram: 4 },
  { key: 'fat', label: 'Жиры', short: 'Ж', kcalPerGram: 9 },
  { key: 'carbs', label: 'Углеводы', short: 'У', kcalPerGram: 4 },
]

function dayTitle(date: string, today: string): string {
  if (date === today) return 'Сегодня'
  if (date === addDays(today, -1)) return 'Вчера'
  const d = parseISODate(date)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`
}

/** «1 450» — разряды через неразрывный пробел. */
const kcal = (v: number) => Math.round(v).toLocaleString('ru-RU')
const grams = (v: number) => formatDecimal(Math.round(v))

/** Доля от плана для полоски, 0–100. */
const percent = (value: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0

/** «Питание» → «Дневник»: еда по дням, итоги против плана, график калорий за неделю. */
export function NutritionPanel({ onCalc }: { onCalc: () => void }) {
  const repos = useRepos()
  const today = toISODate(new Date())
  const [date, setDate] = useState(today)
  const [editing, setEditing] = useState<Meal | 'new' | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  const meals = useLiveQuery(() => repos.meals.listDay(date), [repos, date])
  const week = useLiveQuery(() => repos.meals.listRange(addDays(today, -6), today), [repos, today])
  const plan = useLiveQuery(() => repos.meta.get('nutritionPlan'), [repos])
  if (!meals || !week || plan === undefined) return null

  const total = sumNutrients(meals)
  const left = plan ? plan.calories - total.calories : null
  const days = dailyTotals(week, today, 7)

  return (
    <>
      <div className={styles.dayNav}>
        <IconButton
          icon="back"
          label="Предыдущий день"
          onClick={() => setDate(addDays(date, -1))}
        />
        <h2 className={styles.day} aria-live="polite">
          {dayTitle(date, today)}
        </h2>
        <IconButton
          icon="chevron"
          label="Следующий день"
          disabled={date >= today}
          onClick={() => setDate(addDays(date, 1))}
        />
      </div>

      <Card>
        <div className={styles.calHead}>
          <span className={styles.label}>Калории</span>
          <Button size="sm" variant="ghost" onClick={() => setPlanOpen(true)}>
            {plan ? 'План' : 'Задать план'}
          </Button>
        </div>
        <button
          type="button"
          className={styles.big}
          onClick={() => setBreakdownOpen(true)}
          aria-label={`${kcal(total.calories)} ккал — откуда калории`}
        >
          {kcal(total.calories)}
          <span> {plan ? `/ ${kcal(plan.calories)} ккал` : 'ккал'}</span>
          <Icon name="chevron" size={18} />
        </button>
        {plan && (
          <>
            <div className={styles.bar} aria-hidden="true">
              <span
                className={left !== null && left < 0 ? styles.over : undefined}
                style={{ width: `${percent(total.calories, plan.calories)}%` }}
              />
            </div>
            <p className={styles.left}>
              {left !== null && left >= 0
                ? `Осталось ${kcal(left)} ккал`
                : `Больше плана на ${kcal(-(left ?? 0))} ккал`}
            </p>
          </>
        )}
        <div className={styles.macros}>
          {MACROS.map((m) => {
            const target = plan?.[m.key] ?? 0
            return (
              <div key={m.key} className={styles.macro}>
                <span className={styles.label}>{m.label}</span>
                <b>
                  {grams(total[m.key])}
                  <span>{target ? ` / ${grams(target)} г` : ' г'}</span>
                </b>
                {target > 0 && (
                  <div className={`${styles.bar} ${styles.thin}`} aria-hidden="true">
                    <span
                      className={styles[m.key]}
                      style={{ width: `${percent(total[m.key], target)}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Button variant="primary" block icon="plus" onClick={() => setEditing('new')}>
        Добавить еду
      </Button>

      {meals.length > 0 && (
        <>
          <SectionLabel>Приёмы пищи</SectionLabel>
          <ul className={styles.list} aria-label="Приёмы пищи">
            {meals.map((m) => (
              <li key={m.id}>
                <button type="button" className={styles.meal} onClick={() => setEditing(m)}>
                  <span className={styles.mealText}>
                    <b>{m.name}</b>
                    <span>
                      {m.grams ? `${m.grams} г · ` : ''}
                      {MACROS.map((x) => `${x.short} ${grams(m[x.key])}`).join(' · ')}
                    </span>
                  </span>
                  <span className={styles.mealKcal}>{kcal(m.calories)} ккал</span>
                </button>
                <IconButton
                  icon="close"
                  size="sm"
                  label={`Удалить «${m.name}»`}
                  onClick={() => repos.meals.remove(m.id)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {week.length > 0 && (
        <Card>
          <h2 className={styles.cardTitle}>Калории за 7 дней</h2>
          <LineChart
            points={days.map((d) => {
              const day = parseISODate(d.date)
              return {
                label: `${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`,
                values: {
                  kcal: d.total.calories,
                  ...(plan ? { plan: plan.calories } : {}),
                } as Record<string, number>,
              }
            })}
            series={[
              { key: 'kcal', name: 'Съедено', color: 'var(--chart-1)' },
              ...(plan
                ? [{ key: 'plan', name: 'План', color: 'var(--chart-2)', dashed: true }]
                : []),
            ]}
            format={kcal}
            ariaLabel={`Калории за 7 дней, сегодня ${kcal(days[6].total.calories)} ккал`}
          />
        </Card>
      )}

      <BotLinks text="Записывайте еду сообщением или фото прямо из мессенджера — бот посчитает КБЖУ и добавит в дневник." />

      <MealSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        date={date}
        meal={editing === 'new' ? null : editing}
      />
      <Sheet
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        title={`Калории: ${dayTitle(date, today).toLowerCase()}`}
      >
        <Breakdown meals={meals} />
      </Sheet>
      <NutritionPlanSheet
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        plan={plan}
        onCalc={() => {
          setPlanOpen(false)
          onCalc()
        }}
      />
    </>
  )
}

/** Шторка по нажатию на калории: доли Б/Ж/У в энергии и самые калорийные блюда дня. */
function Breakdown({ meals }: { meals: Meal[] }) {
  if (!meals.length) return <p className={styles.empty}>За этот день еда ещё не записана.</p>
  const total = sumNutrients(meals)
  const fromMacros = MACROS.map((m) => ({ ...m, kcal: total[m.key] * m.kcalPerGram }))
  const macroKcal = fromMacros.reduce((s, m) => s + m.kcal, 0)
  const top = [...meals].sort((a, b) => b.calories - a.calories)
  return (
    <>
      <section className={styles.breakdown} aria-label="Откуда калории">
        <SectionLabel>Откуда калории</SectionLabel>
        {fromMacros.map((m) => {
          const share = macroKcal > 0 ? Math.round((m.kcal / macroKcal) * 100) : 0
          return (
            <div key={m.key} className={styles.share}>
              <div className={styles.shareHead}>
                <span>{m.label}</span>
                <span className={styles.shareValue}>
                  {grams(total[m.key])} г · {kcal(m.kcal)} ккал · <b>{share}%</b>
                </span>
              </div>
              <div className={`${styles.bar} ${styles.thin}`} aria-hidden="true">
                <span className={styles[m.key]} style={{ width: `${share}%` }} />
              </div>
            </div>
          )
        })}
      </section>
      <section className={styles.breakdown} aria-label="Самое калорийное">
        <SectionLabel>Самое калорийное</SectionLabel>
        <ol className={styles.topList}>
          {top.map((m) => (
            <li key={m.id}>
              <span className={styles.topName}>{m.name}</span>
              <span className={styles.shareValue}>
                {kcal(m.calories)} ккал ·{' '}
                {total.calories > 0 ? Math.round((m.calories / total.calories) * 100) : 0}%
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
