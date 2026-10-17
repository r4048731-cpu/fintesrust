import { newId } from '../../domain/id'
import type { CustomRecipe, ID, RecipeIngredient } from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'
import type { metaRepo } from './meta'

export const RECIPE_LIMITS = {
  title: 80,
  minutes: { min: 0, max: 600 },
  grams: { min: 1, max: 5000 },
  ingredients: 30,
} as const

export interface RecipeInput {
  title: string
  minutes: number
  ingredients: RecipeIngredient[]
  steps: string[]
}

/** Ошибка ввода: текст показывается пользователю как есть. */
export class RecipeValidationError extends Error {}

function normalize(input: RecipeInput): RecipeInput {
  const title = input.title.trim()
  if (!title) throw new RecipeValidationError('Введите название блюда')
  if (title.length > RECIPE_LIMITS.title) {
    throw new RecipeValidationError(`Название длиннее ${RECIPE_LIMITS.title} символов`)
  }
  const { min, max } = RECIPE_LIMITS.minutes
  if (!(input.minutes >= min && input.minutes <= max)) {
    throw new RecipeValidationError(`Время — от ${min} до ${max} минут`)
  }
  if (input.ingredients.length === 0) {
    throw new RecipeValidationError('Добавьте хотя бы один ингредиент')
  }
  if (input.ingredients.length > RECIPE_LIMITS.ingredients) {
    throw new RecipeValidationError(`Не больше ${RECIPE_LIMITS.ingredients} ингредиентов`)
  }
  for (const i of input.ingredients) {
    if (!(i.grams >= RECIPE_LIMITS.grams.min && i.grams <= RECIPE_LIMITS.grams.max)) {
      throw new RecipeValidationError(`Вес «${i.name}» — от 1 до ${RECIPE_LIMITS.grams.max} г`)
    }
  }
  return {
    title,
    minutes: Math.round(input.minutes),
    ingredients: input.ingredients.map((i) => ({ ...i, grams: Math.round(i.grams) })),
    steps: input.steps.map((s) => s.trim()).filter(Boolean),
  }
}

export function recipesRepo(db: FitnessDB, clock: Clock, meta: ReturnType<typeof metaRepo>) {
  return {
    /** Свои блюда, новые сверху. */
    async list(): Promise<CustomRecipe[]> {
      const rows = await db.recipes.toArray()
      return rows.filter((r) => r.deletedAt === null).sort((a, b) => b.createdAt - a.createdAt)
    },

    async add(input: RecipeInput): Promise<CustomRecipe> {
      const now = clock()
      const recipe: CustomRecipe = {
        id: newId(),
        ...normalize(input),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await db.recipes.add(recipe)
      return recipe
    },

    async update(id: ID, input: RecipeInput): Promise<void> {
      await db.recipes.update(id, { ...normalize(input), updatedAt: clock() })
    },

    /** Мягкое удаление; из любимых блюдо тоже уходит. */
    async remove(id: ID): Promise<void> {
      await db.recipes.update(id, { deletedAt: clock(), updatedAt: clock() })
      const favorites = await meta.get('favoriteRecipes')
      if (favorites.includes(id)) {
        await meta.set(
          'favoriteRecipes',
          favorites.filter((f) => f !== id),
        )
      }
    },

    async favorites(): Promise<ID[]> {
      return meta.get('favoriteRecipes')
    },

    /** Добавить в любимые или убрать оттуда. Возвращает новое состояние. */
    async toggleFavorite(id: ID): Promise<boolean> {
      const favorites = await meta.get('favoriteRecipes')
      const on = !favorites.includes(id)
      await meta.set('favoriteRecipes', on ? [...favorites, id] : favorites.filter((f) => f !== id))
      return on
    },
  }
}
