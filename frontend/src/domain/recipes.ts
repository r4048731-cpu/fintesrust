// Встроенные рецепты по подборкам. КБЖУ не вписаны руками, а считаются из ингредиентов
// по справочнику продуктов — так цифры всегда сходятся с ним.

import { FOODS } from './foods'
import { sumNutrients, scaleNutrients } from './nutrition'
import type { CustomRecipe, Nutrients, RecipeIngredient } from './types'

export interface Recipe {
  id: string
  title: string
  collection: CollectionId
  minutes: number
  /** [название из справочника, граммы] — на одну порцию. */
  ingredients: [string, number][]
  steps: string[]
}

export type CollectionId = 'breakfast' | 'snack' | 'meal' | 'nooven'

export const COLLECTIONS: { id: CollectionId; title: string; text: string }[] = [
  {
    id: 'breakfast',
    title: 'Белковый завтрак',
    text: 'Много белка, чтобы сытости хватило до обеда',
  },
  { id: 'snack', title: 'Быстрый перекус', text: 'За 5 минут, без плиты' },
  { id: 'meal', title: 'Обед и ужин', text: 'Белок, гарнир и овощи на одной тарелке' },
  { id: 'nooven', title: 'Выпечка без духовки', text: 'Сковорода или микроволновка' },
]

export const RECIPES: Recipe[] = [
  {
    id: 'choco-cottage-cream',
    title: 'Шоколадный творожный крем',
    collection: 'breakfast',
    minutes: 5,
    ingredients: [
      ['Творог 5%', 200],
      ['Йогурт греческий 0%', 100],
      ['Какао-порошок', 10],
      ['Мёд', 15],
    ],
    steps: [
      'Сложите творог, йогурт, какао и мёд в высокую миску.',
      'Пробейте блендером до гладкого крема, 1–2 минуты.',
      'Можно есть сразу или убрать в холодильник на 30 минут — станет плотнее.',
    ],
  },
  {
    id: 'protein-pancakes',
    title: 'Протеиновые блины',
    collection: 'breakfast',
    minutes: 15,
    ingredients: [
      ['Яйцо куриное', 110],
      ['Овсяные хлопья', 40],
      ['Молоко 2,5%', 100],
      ['Протеин сывороточный', 20],
    ],
    steps: [
      'Измельчите хлопья в муку блендером.',
      'Смешайте с яйцами, молоком и протеином, дайте постоять 5 минут.',
      'Жарьте тонкие блины на сухой антипригарной сковороде по минуте с каждой стороны.',
    ],
  },
  {
    id: 'syrniki',
    title: 'Сырники на сковороде',
    collection: 'breakfast',
    minutes: 20,
    ingredients: [
      ['Творог 5%', 200],
      ['Яйцо куриное', 55],
      ['Мука пшеничная', 30],
      ['Масло подсолнечное', 5],
    ],
    steps: [
      'Разомните творог вилкой, вмешайте яйцо и половину муки.',
      'Слепите 5–6 шайб, обваляйте в оставшейся муке.',
      'Жарьте на смазанной маслом сковороде под крышкой по 3–4 минуты с каждой стороны.',
    ],
  },
  {
    id: 'veggie-omelette',
    title: 'Омлет с овощами',
    collection: 'breakfast',
    minutes: 10,
    ingredients: [
      ['Яйцо куриное', 165],
      ['Молоко 2,5%', 50],
      ['Помидор', 100],
      ['Перец болгарский', 80],
      ['Сыр твёрдый', 20],
    ],
    steps: [
      'Нарежьте помидор и перец, обжарьте 2 минуты на сухой сковороде.',
      'Взбейте яйца с молоком, залейте овощи.',
      'Посыпьте тёртым сыром и готовьте под крышкой на слабом огне 5 минут.',
    ],
  },
  {
    id: 'oats-banana-pb',
    title: 'Овсянка с бананом и арахисовой пастой',
    collection: 'breakfast',
    minutes: 7,
    ingredients: [
      ['Овсяные хлопья', 60],
      ['Молоко 2,5%', 200],
      ['Банан', 100],
      ['Арахисовая паста', 15],
    ],
    steps: [
      'Варите хлопья в молоке 4–5 минут, помешивая.',
      'Выложите сверху нарезанный банан и ложку арахисовой пасты.',
    ],
  },
  {
    id: 'banana-smoothie',
    title: 'Банановый смузи с миндалём',
    collection: 'snack',
    minutes: 3,
    ingredients: [
      ['Банан', 120],
      ['Молоко 2,5%', 250],
      ['Миндаль', 15],
      ['Мёд', 10],
    ],
    steps: ['Сложите всё в блендер и пробейте до однородности. Холоднее — с замороженным бананом.'],
  },
  {
    id: 'pb-cottage-cream',
    title: 'Арахисово-творожный крем',
    collection: 'snack',
    minutes: 3,
    ingredients: [
      ['Творог 5%', 150],
      ['Арахисовая паста', 20],
      ['Мёд', 10],
    ],
    steps: ['Пробейте творог с пастой и мёдом блендером или тщательно разотрите вилкой.'],
  },
  {
    id: 'protein-shake',
    title: 'Протеиновый коктейль с бананом',
    collection: 'snack',
    minutes: 2,
    ingredients: [
      ['Протеин сывороточный', 30],
      ['Молоко 1,5%', 300],
      ['Банан', 100],
    ],
    steps: ['Пробейте всё блендером или встряхните в шейкере, банан предварительно разомните.'],
  },
  {
    id: 'yogurt-berries',
    title: 'Йогурт с черникой и орехами',
    collection: 'snack',
    minutes: 2,
    ingredients: [
      ['Йогурт греческий 0%', 200],
      ['Черника', 80],
      ['Грецкий орех', 15],
    ],
    steps: ['Выложите йогурт в миску, сверху ягоды и рубленые орехи.'],
  },
  {
    id: 'chicken-buckwheat',
    title: 'Курица с гречкой и овощами',
    collection: 'meal',
    minutes: 30,
    ingredients: [
      ['Куриная грудка запечённая', 150],
      ['Гречка варёная', 200],
      ['Огурец', 100],
      ['Помидор', 100],
      ['Масло оливковое', 5],
    ],
    steps: [
      'Запеките грудку при 200 °C 20–25 минут, дайте полежать 5 минут и нарежьте.',
      'Отварите гречку.',
      'Нарежьте овощи, заправьте маслом и подавайте всё вместе.',
    ],
  },
  {
    id: 'salmon-rice',
    title: 'Горбуша с рисом и брокколи',
    collection: 'meal',
    minutes: 25,
    ingredients: [
      ['Горбуша', 150],
      ['Рис варёный', 180],
      ['Брокколи', 150],
    ],
    steps: [
      'Запеките горбушу в фольге при 200 °C 15–18 минут.',
      'Брокколи приготовьте на пару или отварите 4 минуты.',
      'Подавайте с рисом.',
    ],
  },
  {
    id: 'home-shawarma',
    title: 'Домашняя шаурма',
    collection: 'meal',
    minutes: 15,
    ingredients: [
      ['Лаваш', 70],
      ['Куриная грудка запечённая', 120],
      ['Огурец', 60],
      ['Помидор', 60],
      ['Капуста белокочанная', 50],
      ['Йогурт греческий 0%', 50],
    ],
    steps: [
      'Йогурт посолите и добавьте чеснок — это соус.',
      'Смажьте лаваш соусом, выложите курицу, нашинкованную капусту и овощи.',
      'Сверните и подрумяньте на сухой сковороде по минуте с каждой стороны.',
    ],
  },
  {
    id: 'tuna-salad',
    title: 'Салат с тунцом и яйцом',
    collection: 'meal',
    minutes: 15,
    ingredients: [
      ['Тунец консервированный в собственном соку', 120],
      ['Яйцо куриное', 110],
      ['Огурец', 100],
      ['Помидор', 100],
      ['Салат листовой', 50],
      ['Масло оливковое', 10],
    ],
    steps: [
      'Сварите яйца вкрутую, 9 минут.',
      'Нарежьте овощи и яйца, добавьте тунец без жидкости.',
      'Заправьте маслом, посолите и поперчите.',
    ],
  },
  {
    id: 'turkey-pasta',
    title: 'Паста с индейкой и томатами',
    collection: 'meal',
    minutes: 25,
    ingredients: [
      ['Макароны варёные', 200],
      ['Индейка, грудка запечённая', 120],
      ['Помидор', 150],
      ['Сыр твёрдый', 15],
    ],
    steps: [
      'Обжарьте нарезанную индейку 6–7 минут.',
      'Добавьте нарезанные помидоры и тушите 5 минут, чтобы получился соус.',
      'Смешайте с пастой и посыпьте тёртым сыром.',
    ],
  },
  {
    id: 'oat-flatbread',
    title: 'Овсяноблин с творогом и огурцом',
    collection: 'nooven',
    minutes: 10,
    ingredients: [
      ['Овсяные хлопья', 40],
      ['Яйцо куриное', 55],
      ['Молоко 2,5%', 50],
      ['Творог 5%', 80],
      ['Огурец', 50],
    ],
    steps: [
      'Смешайте хлопья, яйцо и молоко, дайте постоять 3 минуты.',
      'Вылейте на сухую сковороду и жарьте под крышкой по 2–3 минуты с каждой стороны.',
      'Намажьте творогом, выложите кружки огурца и сложите пополам.',
    ],
  },
  {
    id: 'mug-cake',
    title: 'Шоколадный кекс в кружке',
    collection: 'nooven',
    minutes: 5,
    ingredients: [
      ['Овсяные хлопья', 40],
      ['Яйцо куриное', 55],
      ['Банан', 60],
      ['Какао-порошок', 5],
      ['Протеин сывороточный', 15],
    ],
    steps: [
      'Разомните банан в кружке, вмешайте яйцо, хлопья, какао и протеин.',
      'Готовьте в микроволновке 90 секунд на полной мощности.',
    ],
  },
  {
    id: 'mw-casserole',
    title: 'Творожная запеканка в микроволновке',
    collection: 'nooven',
    minutes: 10,
    ingredients: [
      ['Творог 5%', 200],
      ['Яйцо куриное', 55],
      ['Манная крупа', 20],
      ['Изюм', 20],
    ],
    steps: [
      'Смешайте творог, яйцо и манку, оставьте на 5 минут, чтобы манка набухла.',
      'Вмешайте изюм, выложите в форму для микроволновки.',
      'Готовьте 4–5 минут на средней мощности, дайте остыть 5 минут.',
    ],
  },
]

const FOOD_BY_NAME = new Map(FOODS.map((f) => [f.name, f]))

/** КБЖУ одной порции: сумма ингредиентов по справочнику. */
export function recipeNutrients(r: Recipe): Nutrients {
  return sumNutrients(
    r.ingredients.map(([name, grams]) => {
      const food = FOOD_BY_NAME.get(name)
      if (!food) throw new Error(`Нет в справочнике: ${name}`)
      return scaleNutrients(food.per100, 100, grams)
    }),
  )
}

/** Вес порции, г. */
export const recipeGrams = (r: Recipe) => r.ingredients.reduce((s, [, g]) => s + g, 0)

/** Рецепт для экрана — встроенный или своё блюдо, с посчитанным КБЖУ порции. */
export interface RecipeView {
  id: string
  title: string
  /** Подборка встроенного; у своих — `mine`. */
  collection: CollectionId | 'mine'
  minutes: number
  ingredients: { name: string; grams: number }[]
  steps: string[]
  nutrients: Nutrients
  grams: number
  /** Своё блюдо: его можно изменить и удалить. */
  own: boolean
}

export function builtinView(r: Recipe): RecipeView {
  return {
    id: r.id,
    title: r.title,
    collection: r.collection,
    minutes: r.minutes,
    ingredients: r.ingredients.map(([name, grams]) => ({ name, grams })),
    steps: r.steps,
    nutrients: recipeNutrients(r),
    grams: recipeGrams(r),
    own: false,
  }
}

/** КБЖУ своего блюда — по значениям на 100 г, сохранённым в ингредиентах. */
export function ingredientsNutrients(list: RecipeIngredient[]): Nutrients {
  return sumNutrients(list.map((i) => scaleNutrients(i.per100, 100, i.grams)))
}

export function customView(r: CustomRecipe): RecipeView {
  return {
    id: r.id,
    title: r.title,
    collection: 'mine',
    minutes: r.minutes,
    ingredients: r.ingredients.map(({ name, grams }) => ({ name, grams })),
    steps: r.steps,
    nutrients: ingredientsNutrients(r.ingredients),
    grams: r.ingredients.reduce((s, i) => s + i.grams, 0),
    own: true,
  }
}

export const BUILTIN_VIEWS: RecipeView[] = RECIPES.map(builtinView)

const searchWords = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^a-zа-я0-9]+/)
    .filter(Boolean)

/**
 * Подходит ли рецепт под поиск: каждое слово запроса — начало слова в названии
 * или в ингредиентах («твор банан» → крем с творогом и бананом).
 */
export function matchesRecipe(r: RecipeView, query: string): boolean {
  const q = searchWords(query)
  if (q.length === 0) return true
  const text = searchWords([r.title, ...r.ingredients.map((i) => i.name)].join(' '))
  return q.every((part) => text.some((w) => w.startsWith(part)))
}
