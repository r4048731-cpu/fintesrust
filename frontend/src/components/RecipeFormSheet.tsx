import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type FormEvent } from 'react'
import { useRepos } from '../app/dataContext'
import { RECIPE_LIMITS, RecipeValidationError } from '../data/repositories/recipes'
import { foodsFromMeals, searchFoods, type Food } from '../domain/foods'
import { parseDecimal } from '../domain/number'
import { ingredientsNutrients } from '../domain/recipes'
import { scaleNutrients } from '../domain/nutrition'
import type { CustomRecipe, RecipeIngredient } from '../domain/types'
import { Button, IconButton } from './Button'
import { TextAreaField, TextField } from './Field'
import { Sheet } from './Sheet'
import styles from './RecipeFormSheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  /** Что правим; null — новое блюдо. */
  recipe: CustomRecipe | null
  onSaved?: (recipe: CustomRecipe) => void
}

/** Своё блюдо: название, время, ингредиенты с граммами (КБЖУ считаются сами) и шаги. */
export function RecipeFormSheet({ open, onClose, recipe, onSaved }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={recipe ? 'Изменить блюдо' : 'Своё блюдо'} tall>
      {open && (
        <RecipeForm key={recipe?.id ?? 'new'} recipe={recipe} onClose={onClose} onSaved={onSaved} />
      )}
    </Sheet>
  )
}

function RecipeForm({ recipe, onClose, onSaved }: Omit<Props, 'open'>) {
  const repos = useRepos()
  const history = useLiveQuery(() => repos.meals.recent(500), [repos])
  const own = useMemo(() => foodsFromMeals(history ?? []), [history])

  const [title, setTitle] = useState(recipe?.title ?? '')
  const [minutes, setMinutes] = useState(recipe ? String(recipe.minutes) : '15')
  const [items, setItems] = useState<RecipeIngredient[]>(recipe?.ingredients ?? [])
  const [steps, setSteps] = useState(recipe?.steps.join('\n') ?? '')
  const [error, setError] = useState<string | null>(null)

  // Новый ингредиент: продукт выбирается из подсказок — так известно его КБЖУ
  const [query, setQuery] = useState('')
  const [food, setFood] = useState<Food | null>(null)
  const [grams, setGrams] = useState('100')
  const foods = food ? [] : searchFoods(query, own)
  const total = ingredientsNutrients(items)

  function addItem() {
    const g = parseDecimal(grams)
    if (!food) {
      setError('Выберите продукт из подсказок')
      return
    }
    if (g === null || g < RECIPE_LIMITS.grams.min || g > RECIPE_LIMITS.grams.max) {
      setError(`Вес — от 1 до ${RECIPE_LIMITS.grams.max} г`)
      return
    }
    setItems([...items, { name: food.name, grams: Math.round(g), per100: food.per100 }])
    setQuery('')
    setFood(null)
    setGrams('100')
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const input = {
      title,
      minutes: parseDecimal(minutes) ?? -1,
      ingredients: items,
      steps: steps.split('\n'),
    }
    try {
      if (recipe) {
        await repos.recipes.update(recipe.id, input)
        onSaved?.({ ...recipe, ...input })
      } else {
        onSaved?.(await repos.recipes.add(input))
      }
      onClose()
    } catch (err) {
      setError(err instanceof RecipeValidationError ? err.message : 'Не удалось сохранить')
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.titleRow}>
        <TextField
          label="Название"
          value={title}
          maxLength={RECIPE_LIMITS.title}
          placeholder="Омлет с сыром"
          autoComplete="off"
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextField
          label="Время, мин"
          value={minutes}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => setMinutes(e.target.value)}
        />
      </div>

      <section className={styles.block} aria-label="Ингредиенты">
        <span className={styles.label}>Ингредиенты на порцию</span>
        {items.length > 0 && (
          <ul className={styles.items}>
            {items.map((i, idx) => (
              <li key={`${i.name}-${idx}`}>
                <span className={styles.itemName}>{i.name}</span>
                <span className={styles.itemMeta}>
                  {i.grams} г · {Math.round(scaleNutrients(i.per100, 100, i.grams).calories)} ккал
                </span>
                <IconButton
                  icon="close"
                  size="sm"
                  label={`Убрать «${i.name}»`}
                  onClick={() => setItems(items.filter((_, j) => j !== idx))}
                />
              </li>
            ))}
          </ul>
        )}
        <div className={styles.addRow}>
          <TextField
            label="Продукт"
            value={food ? food.name : query}
            placeholder="Начните вводить"
            autoComplete="off"
            onChange={(e) => {
              setFood(null)
              setQuery(e.target.value)
              setError(null)
            }}
          />
          <TextField
            label="Вес, г"
            value={grams}
            inputMode="decimal"
            autoComplete="off"
            onChange={(e) => setGrams(e.target.value)}
          />
          <Button onClick={addItem} aria-label="Добавить ингредиент" icon="plus" />
        </div>
        {foods.length > 0 && (
          <ul className={styles.foods} aria-label="Подходящие продукты">
            {foods.map((f) => (
              <li key={(f.own ? 'own:' : '') + f.name}>
                <button type="button" className={styles.food} onClick={() => setFood(f)}>
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
        <p className={styles.total} role="status" aria-label="Итого на порцию">
          {items.length
            ? `Порция: ${Math.round(total.calories)} ккал · Б ${Math.round(total.protein)} · Ж ${Math.round(total.fat)} · У ${Math.round(total.carbs)}`
            : 'Продукты — из справочника или из своих записей в дневнике.'}
        </p>
      </section>

      <TextAreaField
        label="Приготовление — по шагу на строку"
        value={steps}
        placeholder={'Взбейте яйца с молоком\nЖарьте 3 минуты под крышкой'}
        onChange={(e) => setSteps(e.target.value)}
      />

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" block>
        {recipe ? 'Сохранить' : 'Добавить блюдо'}
      </Button>
    </form>
  )
}
