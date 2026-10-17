import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useRepos } from '../app/dataContext'
import { foodsFromMeals, searchFoods, type Food } from '../domain/foods'
import { caloriesFromMacros, NUTRIENT_KEYS, scaleNutrients } from '../domain/nutrition'
import { formatDecimal, parseDecimal } from '../domain/number'
import type { ISODate, Meal, Nutrients } from '../domain/types'
import { Button } from './Button'
import { TextField } from './Field'
import { Sheet } from './Sheet'
import styles from './MealSheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  /** День, в который добавляется еда. */
  date: ISODate
  /** Что правим; null — новая запись. */
  meal: Meal | null
}

/** Добавление и правка приёма пищи: название, вес порции, калории и Б/Ж/У. */
export function MealSheet({ open, onClose, date, meal }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={meal ? 'Изменить' : 'Добавить еду'}>
      {open && <MealForm key={meal?.id ?? 'new'} date={date} meal={meal} onClose={onClose} />}
    </Sheet>
  )
}

type Texts = Record<'name' | 'grams' | keyof Nutrients, string>

/** Значения, от которых пересчитывается порция при смене веса. */
interface Base {
  grams: number
  nutrients: Nutrients
}

const num = (v: number) => formatDecimal(v)
const toTexts = (m: Pick<Meal, 'name' | 'grams'> & Nutrients): Texts => ({
  name: m.name,
  grams: m.grams === null ? '' : String(m.grams),
  calories: num(m.calories),
  protein: num(m.protein),
  fat: num(m.fat),
  carbs: num(m.carbs),
})
const EMPTY: Texts = { name: '', grams: '', calories: '', protein: '', fat: '', carbs: '' }

const NUTRIENT_FIELDS: { key: keyof Nutrients; label: string }[] = [
  { key: 'calories', label: 'Ккал' },
  { key: 'protein', label: 'Белки, г' },
  { key: 'fat', label: 'Жиры, г' },
  { key: 'carbs', label: 'Углев., г' },
]

/** Пустое поле Б/Ж/У — ноль; мусор — null. */
const macro = (text: string) => (text.trim() === '' ? 0 : parseDecimal(text))

function readNutrients(t: Texts): Nutrients | null {
  const calories = parseDecimal(t.calories)
  const protein = macro(t.protein)
  const fat = macro(t.fat)
  const carbs = macro(t.carbs)
  if (calories === null || protein === null || fat === null || carbs === null) return null
  return { calories, protein, fat, carbs }
}

function baseOf(m: Pick<Meal, 'grams'> & Nutrients): Base | null {
  return m.grams ? { grams: m.grams, nutrients: m } : null
}

function MealForm({
  date,
  meal,
  onClose,
}: {
  date: ISODate
  meal: Meal | null
  onClose: () => void
}) {
  const repos = useRepos()
  const history = useLiveQuery(() => repos.meals.recent(500), [repos])
  const recent = meal ? [] : history?.slice(0, 12)
  const own = useMemo(() => foodsFromMeals(history ?? []), [history])
  const [t, setT] = useState<Texts>(meal ? toTexts(meal) : EMPTY)
  const [base, setBase] = useState<Base | null>(meal ? baseOf(meal) : null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Подсказки показываются, пока название набирают, и прячутся после выбора. */
  const [suggest, setSuggest] = useState(false)
  const foods = suggest ? searchFoods(t.name, own) : []

  function pick(m: Meal) {
    setT(toTexts(m))
    setBase(baseOf(m))
    setError(null)
  }

  /** Продукт из справочника или своих: КБЖУ считаются на введённый вес, без веса — на 100 г. */
  function pickFood(f: Food) {
    const typed = parseDecimal(t.grams)
    const grams = typed !== null && typed > 0 ? typed : 100
    const scaled = scaleNutrients(f.per100, 100, grams)
    const texts = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, num(scaled[k])]))
    setT({ ...t, ...texts, name: f.name, grams: num(grams) } as Texts)
    setBase({ grams: 100, nutrients: f.per100 })
    setSuggest(false)
    setError(null)
  }

  function changeGrams(text: string) {
    const grams = parseDecimal(text)
    if (base && grams !== null && grams > 0) {
      const scaled = scaleNutrients(base.nutrients, base.grams, grams)
      const texts = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, num(scaled[k])]))
      setT((prev) => ({ ...prev, ...texts, grams: text }))
    } else {
      setT((prev) => ({ ...prev, grams: text }))
    }
  }

  /** Правка значений вручную: дальше пересчёт по весу идёт уже от них. */
  function changeNutrient(key: keyof Nutrients, text: string) {
    const next = { ...t, [key]: text }
    setT(next)
    const grams = parseDecimal(next.grams)
    const nutrients = readNutrients(next)
    setBase(grams && grams > 0 && nutrients ? { grams, nutrients } : null)
  }

  const macros = { protein: macro(t.protein), fat: macro(t.fat), carbs: macro(t.carbs) }
  const byMacros =
    macros.protein !== null && macros.fat !== null && macros.carbs !== null
      ? caloriesFromMacros(macros as Omit<Nutrients, 'calories'>)
      : 0

  async function save() {
    setError(null)
    const nutrients = readNutrients(t)
    const grams = t.grams.trim() === '' ? null : parseDecimal(t.grams)
    if (!t.name.trim()) return setError('Введите название')
    if (nutrients === null)
      return setError('Введите калории, а Б/Ж/У — числами или оставьте пустыми')
    if (grams === null && t.grams.trim() !== '') return setError('Вес порции — числом, в граммах')
    setBusy(true)
    try {
      const input = { name: t.name, grams, ...nutrients }
      if (meal) await repos.meals.update(meal.id, input)
      else await repos.meals.add(input, date)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
      setBusy(false)
    }
  }

  async function remove() {
    if (!meal) return
    await repos.meals.remove(meal.id)
    onClose()
  }

  return (
    <div className={styles.form}>
      {recent && recent.length > 0 && (
        <div className={styles.recentBlock}>
          <span className={styles.label}>Недавние</span>
          <div className={styles.recent} role="group" aria-label="Недавние блюда">
            {recent.map((m) => (
              <button key={m.id} type="button" className={styles.chip} onClick={() => pick(m)}>
                <b>{m.name}</b>
                <span>
                  {m.grams ? `${m.grams} г · ` : ''}
                  {Math.round(m.calories)} ккал
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.nameRow}>
        <TextField
          label="Название"
          value={t.name}
          maxLength={80}
          autoComplete="off"
          enterKeyHint="next"
          placeholder="Гречка с курицей"
          onChange={(e) => {
            setT({ ...t, name: e.target.value })
            setSuggest(true)
          }}
        />
        <TextField
          label="Вес, г"
          value={t.grams}
          inputMode="decimal"
          autoComplete="off"
          onChange={(e) => changeGrams(e.target.value)}
        />
      </div>

      {foods.length > 0 && (
        <ul className={styles.foods} aria-label="Подходящие продукты">
          {foods.map((f) => (
            <li key={(f.own ? 'own:' : '') + f.name}>
              <button type="button" className={styles.food} onClick={() => pickFood(f)}>
                <b>{f.name}</b>
                <span>
                  {f.own ? 'моё · ' : ''}
                  {Math.round(f.per100.calories)} ккал на 100 г
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.grid}>
        {NUTRIENT_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={t[f.key]}
            inputMode="decimal"
            autoComplete="off"
            onChange={(e) => changeNutrient(f.key, e.target.value)}
          />
        ))}
      </div>

      {base && <p className={styles.hint}>При смене веса значения пересчитаются.</p>}
      {t.calories.trim() === '' && byMacros > 0 && (
        <p className={styles.hint}>
          По Б/Ж/У выходит ≈ {byMacros} ккал.{' '}
          <button
            type="button"
            className={styles.link}
            onClick={() => changeNutrient('calories', String(byMacros))}
          >
            Подставить
          </button>
        </p>
      )}

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <Button variant="primary" block disabled={busy} onClick={save}>
        {meal ? 'Сохранить' : 'Добавить'}
      </Button>
      {meal && (
        <Button variant="danger" block onClick={remove}>
          Удалить
        </Button>
      )}
    </div>
  )
}
