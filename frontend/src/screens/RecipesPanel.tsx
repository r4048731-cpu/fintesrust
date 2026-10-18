import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useRepos } from '../app/dataContext'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/EmptyState'
import { RecipeFormSheet } from '../components/RecipeFormSheet'
import { Sheet } from '../components/Sheet'
import { Tabs } from '../components/Tabs'
import { toISODate } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import {
  BUILTIN_VIEWS,
  COLLECTIONS,
  customView,
  matchesRecipe,
  type RecipeView,
} from '../domain/recipes'
import type { CustomRecipe } from '../domain/types'
import styles from './RecipesPanel.module.css'

const MACROS = [
  { key: 'protein', short: 'Б', label: 'Белки' },
  { key: 'fat', short: 'Ж', label: 'Жиры' },
  { key: 'carbs', short: 'У', label: 'Углеводы' },
] as const

const g = (v: number) => formatDecimal(Math.round(v))

/** Вкладка рецептов. Хранится в адресе: ?menu=mine|favorites. */
type Menu = 'all' | 'mine' | 'favorites'

const MENUS: { value: Menu; label: string }[] = [
  { value: 'all', label: 'Всё меню' },
  { value: 'mine', label: 'Мои блюда' },
  { value: 'favorites', label: 'Любимые блюда' },
]

/** Сколько держать полоску «Записано в дневник · Отменить». */
const UNDO_MS = 6000

/**
 * «Питание» → «Рецепты»: три вкладки — встроенные подборки, свои блюда и любимые.
 * По нажатию на карточку — состав, шаги, «в любимые» и добавление в дневник.
 */
export function RecipesPanel({ onAdded }: { onAdded: () => void }) {
  const repos = useRepos()
  const [params, setParams] = useSearchParams()
  const requested = params.get('menu')
  const menu: Menu = MENUS.some((m) => m.value === requested) ? (requested as Menu) : 'all'
  const custom = useLiveQuery(() => repos.recipes.list(), [repos])
  const favorites = useLiveQuery(() => repos.recipes.favorites(), [repos])
  const [openId, setOpenId] = useState<string | null>(null)
  /** Форма своего блюда: 'new' — новое, иначе правим это. */
  const [editing, setEditing] = useState<CustomRecipe | 'new' | null>(null)
  const [query, setQuery] = useState('')
  /** Последняя запись из «+» на карточке — её можно отменить. */
  const [added, setAdded] = useState<{ mealId: string; title: string } | null>(null)

  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [added])

  if (!custom || !favorites) return null

  const mine = custom.map(customView)
  const all = new Map([...mine, ...BUILTIN_VIEWS].map((v) => [v.id, v]))
  const favoriteViews = favorites.flatMap((id) => all.get(id) ?? [])
  const open = openId ? all.get(openId) : undefined
  const searching = query.trim() !== ''
  const found = (list: RecipeView[]) => list.filter((r) => matchesRecipe(r, query))

  /** «+» на карточке: порция сразу в дневник за сегодня, без открытия рецепта. */
  async function quickAdd(r: RecipeView) {
    const meal = await repos.meals.add(
      { name: r.title, grams: r.grams, ...r.nutrients },
      toISODate(new Date()),
    )
    setAdded({ mealId: meal.id, title: r.title })
  }

  const card = (r: RecipeView) => (
    <li key={r.id} className={styles.cardWrap}>
      <button
        type="button"
        className={`${styles.card} ${styles[r.collection]}`}
        onClick={() => setOpenId(r.id)}
      >
        <span className={styles.kcal}>{Math.round(r.nutrients.calories)} ккал</span>
        <span className={styles.cardTitle}>{r.title}</span>
        <span className={styles.cardMeta}>
          {r.minutes} мин · Б {g(r.nutrients.protein)} · Ж {g(r.nutrients.fat)} · У{' '}
          {g(r.nutrients.carbs)}
        </span>
      </button>
      {/* Отдельная кнопка поверх карточки: кнопку в кнопку вкладывать нельзя */}
      <button
        type="button"
        className={styles.heart}
        aria-pressed={favorites.includes(r.id)}
        aria-label={`«${r.title}» в любимые`}
        onClick={() => repos.recipes.toggleFavorite(r.id)}
      >
        <Icon name="heart" size={18} />
      </button>
      <button
        type="button"
        className={`${styles.heart} ${styles.quick}`}
        aria-label={`«${r.title}» в дневник`}
        onClick={() => quickAdd(r)}
      >
        <Icon name="plus" size={18} />
      </button>
    </li>
  )

  const grid = (list: RecipeView[], label: string) =>
    list.length ? (
      <ul className={styles.grid} aria-label={label}>
        {list.map(card)}
      </ul>
    ) : (
      <p className={styles.sub}>Ничего не нашлось.</p>
    )

  return (
    <>
      <input
        type="search"
        className={styles.search}
        placeholder="Поиск: блюдо или продукт"
        aria-label="Поиск рецептов"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        enterKeyHint="search"
      />

      <Tabs
        label="Меню рецептов"
        options={MENUS.map((m) => ({
          ...m,
          count:
            m.value === 'all'
              ? BUILTIN_VIEWS.length
              : m.value === 'mine'
                ? mine.length
                : favoriteViews.length,
        }))}
        value={menu}
        onChange={(m) => {
          const next = new URLSearchParams(params)
          if (m === 'all') next.delete('menu')
          else next.set('menu', m)
          setParams(next, { replace: true })
        }}
      />

      {added && (
        <div className={styles.undo} role="status">
          <span>«{added.title}» — в дневнике</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await repos.meals.remove(added.mealId)
              setAdded(null)
            }}
          >
            Отменить
          </Button>
        </div>
      )}

      {/* При поиске во «Всём меню» ищем и среди своих блюд — одной сеткой */}
      {menu === 'all' && searching && grid(found([...mine, ...BUILTIN_VIEWS]), 'Найденные рецепты')}
      {menu === 'all' &&
        !searching &&
        COLLECTIONS.map((c) => {
          const list = BUILTIN_VIEWS.filter((r) => r.collection === c.id)
          return (
            <section key={c.id} className={styles.collection} aria-label={c.title}>
              <div className={styles.head}>
                <h2 className={styles.title}>{c.title}</h2>
                <span className={styles.count}>{list.length}</span>
              </div>
              <p className={styles.sub}>{c.text}</p>
              <ul className={styles.row}>{list.map(card)}</ul>
            </section>
          )
        })}

      {menu === 'mine' && (
        <>
          <Button variant="primary" block icon="plus" onClick={() => setEditing('new')}>
            Добавить своё блюдо
          </Button>
          {mine.length === 0 ? (
            <EmptyState title="Своих блюд пока нет" icon="food">
              <p>Добавьте блюдо из продуктов с граммами — КБЖУ порции посчитаются сами.</p>
            </EmptyState>
          ) : (
            grid(found(mine), 'Мои блюда')
          )}
        </>
      )}

      {menu === 'favorites' &&
        (favoriteViews.length === 0 ? (
          <EmptyState title="Любимых блюд пока нет" icon="heart">
            <p>Нажмите сердечко на карточке рецепта — он появится здесь.</p>
          </EmptyState>
        ) : (
          grid(found(favoriteViews), 'Любимые блюда')
        ))}

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.title ?? ''}>
        {open && (
          <RecipeDetails
            key={open.id}
            recipe={open}
            favorite={favorites.includes(open.id)}
            onEdit={() => setEditing(custom.find((c) => c.id === open.id) ?? null)}
            onAdded={() => {
              setOpenId(null)
              onAdded()
            }}
            onRemoved={() => setOpenId(null)}
          />
        )}
      </Sheet>

      <RecipeFormSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        recipe={editing === 'new' ? null : editing}
        onSaved={(r) => setOpenId(r.id)}
      />
    </>
  )
}

interface DetailsProps {
  recipe: RecipeView
  favorite: boolean
  onEdit: () => void
  onAdded: () => void
  onRemoved: () => void
}

function RecipeDetails({ recipe, favorite, onEdit, onAdded, onRemoved }: DetailsProps) {
  const repos = useRepos()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const n = recipe.nutrients

  async function add() {
    setBusy(true)
    await repos.meals.add({ name: recipe.title, grams: recipe.grams, ...n }, toISODate(new Date()))
    onAdded()
  }

  return (
    <div className={styles.details}>
      <Button
        variant={favorite ? 'primary' : 'secondary'}
        icon="heart"
        aria-pressed={favorite}
        onClick={() => repos.recipes.toggleFavorite(recipe.id)}
      >
        {favorite ? 'В любимых' : 'В любимые'}
      </Button>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.label}>Ккал</span>
          <b>{Math.round(n.calories)}</b>
        </div>
        {MACROS.map((m) => (
          <div key={m.key} className={styles.tile}>
            <span className={styles.label}>{m.label}</span>
            <b>
              {g(n[m.key])} <span>г</span>
            </b>
          </div>
        ))}
      </div>
      <p className={styles.sub}>
        Порция {recipe.grams} г · {recipe.minutes} мин
      </p>

      <h3 className={styles.section}>Ингредиенты</h3>
      <ul className={styles.ingredients} aria-label="Ингредиенты">
        {recipe.ingredients.map((i, idx) => (
          <li key={`${i.name}-${idx}`}>
            <span>{i.name}</span>
            <span className={styles.grams}>{i.grams} г</span>
          </li>
        ))}
      </ul>

      {recipe.steps.length > 0 && (
        <>
          <h3 className={styles.section}>Приготовление</h3>
          <ol className={styles.steps}>
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </>
      )}

      <Button variant="primary" block icon="plus" disabled={busy} onClick={add}>
        Добавить в дневник
      </Button>

      {recipe.own &&
        (confirm ? (
          <div className={styles.confirm} role="alertdialog" aria-label="Удаление блюда">
            <p>Удалить «{recipe.title}»? В дневнике записи останутся.</p>
            <div className={styles.confirmActions}>
              <Button
                variant="danger"
                onClick={async () => {
                  await repos.recipes.remove(recipe.id)
                  onRemoved()
                }}
              >
                Удалить
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.ownActions}>
            <Button onClick={onEdit}>Изменить</Button>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Удалить
            </Button>
          </div>
        ))}
    </div>
  )
}
