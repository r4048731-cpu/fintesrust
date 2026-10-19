// Картинка блюда без фото: по названию выбирается посуда (тарелка, миска, стакан…),
// по составу — основа (крупа, творог, суп) и что лежит сверху. Так картинку получает
// любое блюдо, в том числе своё: рисовать каждое руками не нужно.

export type Vessel =
  | 'plate'
  | 'bowl'
  | 'soup'
  | 'glass'
  | 'mug'
  | 'jar'
  | 'pan'
  | 'stack'
  | 'toast'
  | 'wrap'
  | 'balls'
  | 'cake'

export type Base =
  | 'rice'
  | 'buckwheat'
  | 'grain'
  | 'pasta'
  | 'potato'
  | 'oats'
  | 'cream'
  | 'chocoCream'
  | 'hummus'
  | 'greens'

export type Topping =
  | 'egg'
  | 'tomato'
  | 'cucumber'
  | 'banana'
  | 'strawberry'
  | 'blueberry'
  | 'broccoli'
  | 'carrot'
  | 'chicken'
  | 'salmon'
  | 'whiteFish'
  | 'shrimp'
  | 'beef'
  | 'avocado'
  | 'nuts'
  | 'greens'
  | 'pepper'
  | 'cheese'
  | 'chickpea'
  | 'beans'
  | 'corn'
  | 'peas'
  | 'apple'
  | 'pumpkin'
  | 'zucchini'
  | 'driedFruit'
  | 'lemon'
  | 'honey'
  | 'potato'
  | 'cocoa'

export interface DishArt {
  vessel: Vessel
  base: Base | null
  /** Что лежит сверху, от самого весомого; не больше четырёх. */
  toppings: Topping[]
  /** Цвет супа, напитка, омлета или блина. */
  fill: string
}

const lower = (s: string) => s.toLowerCase().replace(/ё/g, 'е')

/** Посуда по названию; порядок важен: «кекс в кружке» — кружка, а не выпечка. */
const VESSELS: [RegExp, Vessel][] = [
  [/суп|уха|окрошк|борщ|щи\b/, 'soup'],
  [/кружк|брауни/, 'mug'],
  [/смузи|коктейл|кефир с|ряженк/, 'glass'],
  [/в банке/, 'jar'],
  [/блин|оладь|сырник|панкейк/, 'stack'],
  [/тост|хлебц|бутерброд|брускет/, 'toast'],
  [/ролл|шаурм|лаваш|буррито/, 'wrap'],
  [/конфет|шарик|батончик/, 'balls'],
  [/запеканк|кекс|пирог|пирож|чизкейк/, 'cake'],
  [/омлет|шакшук|яичниц|хачапури/, 'pan'],
  [/крем|каша|овсянк|йогурт|творог с|салат|боул|гранол/, 'bowl'],
]

/** Продукт → что рисовать. Первое совпадение по началу слова в названии продукта. */
const TOPPINGS: [RegExp, Topping][] = [
  [/яйц|яичн|омлет/, 'egg'],
  [/помидор|томат(?!н)/, 'tomato'],
  [/огур/, 'cucumber'],
  [/банан/, 'banana'],
  [/клубник|малин/, 'strawberry'],
  [/черник|голубик|смородин/, 'blueberry'],
  [/брокколи|капуста цвет/, 'broccoli'],
  [/морков/, 'carrot'],
  [/кури|индейк|курин/, 'chicken'],
  [/лосос|семг|горбуш|форел/, 'salmon'],
  [/треск|минта|хек|тунец/, 'whiteFish'],
  [/кревет|краб/, 'shrimp'],
  [/говяд|свин|фарш|печень/, 'beef'],
  [/авокадо/, 'avocado'],
  [/орех|миндал|арахис|кешью|фундук|семечк|чиа/, 'nuts'],
  [/шпинат|зелень|салат лист|укроп|петрушк/, 'greens'],
  [/перец/, 'pepper'],
  [/сыр |сыр$|моцарел|брынз/, 'cheese'],
  [/нут/, 'chickpea'],
  [/фасол|чечевиц/, 'beans'],
  [/кукуруз/, 'corn'],
  [/горош/, 'peas'],
  [/яблок|груш/, 'apple'],
  [/тыкв/, 'pumpkin'],
  [/кабачк|кабачо/, 'zucchini'],
  [/финик|изюм|кураг|чернослив/, 'driedFruit'],
  [/лимон/, 'lemon'],
  [/мед$|мед /, 'honey'],
  [/картоф/, 'potato'],
  [/какао|шоколад/, 'cocoa'],
]

const BASES: [RegExp, Base][] = [
  [/^рис/, 'rice'],
  [/гречк/, 'buckwheat'],
  [/булгур|кускус|пшен|киноа|перловк/, 'grain'],
  [/макарон|паста|лапш|спагет/, 'pasta'],
  [/овсян/, 'oats'],
  [/хумус/, 'hummus'],
  [/творог|йогурт|сметан/, 'cream'],
  [/картоф.*(отвар|пюре)/, 'potato'],
  [/салат лист/, 'greens'],
]

/** Не рисуются: масло, соусы, специи, вода, мука, протеин. */
const HIDDEN =
  /масл|соус|вода|мука|сахар|соль|протеин|молоко|кефир|ряженк|хлеб|лаваш|хлебц|томатная паст|чеснок|лук/

const FILLS: [RegExp, string][] = [
  [/какао|шоколад/, '#7a4a32'],
  [/черник/, '#8e7cc3'],
  [/клубник/, '#f29bb0'],
  [/тыкв/, '#f4a340'],
  [/чечевиц/, '#d9913f'],
  [/помидор|томат/, '#d9412b'],
  [/банан/, '#f6e3a1'],
  [/кабачк/, '#c9d98a'],
]

function fillFor(vessel: Vessel, names: string[], title: string): string {
  const all = [title, ...names].join(' ')
  if (vessel === 'soup') {
    if (/окрошк/.test(all)) return '#f3efe6'
    if (/борщ|свекл/.test(all)) return '#b8323f'
  }
  if (vessel === 'pan' && /шакшук/.test(all)) return '#d9412b'
  if (vessel === 'pan' && /хачапури/.test(all)) return '#f0c56a'
  for (const [re, color] of FILLS) if (re.test(all)) return color
  switch (vessel) {
    case 'soup':
      return '#f2c45a'
    case 'glass':
      return '#f6f1e7'
    case 'pan':
      return '#f6d365'
    case 'stack':
    case 'cake':
      return '#e9b765'
    case 'mug':
      return '#7a4a32'
    default:
      return '#f3ead8'
  }
}

const DOUGH: Vessel[] = ['stack', 'cake', 'mug']

export function dishArt(title: string, ingredients: { name: string; grams: number }[]): DishArt {
  const t = lower(title)
  const vessel = VESSELS.find(([re]) => re.test(t))?.[1] ?? 'plate'
  const sorted = [...ingredients].sort((a, b) => b.grams - a.grams).map((i) => lower(i.name))

  let base: Base | null = null
  if (vessel === 'plate' || vessel === 'bowl' || vessel === 'jar') {
    for (const name of sorted) {
      const found = BASES.find(([re]) => re.test(name))?.[1]
      if (found) {
        base = found
        break
      }
    }
    if (base === 'cream' && sorted.some((n) => /какао|шоколад/.test(n))) base = 'chocoCream'
  }

  const toppings: Topping[] = []
  for (const name of sorted) {
    if (HIDDEN.test(name) && !/яйц|сыр/.test(name)) continue
    const found = TOPPINGS.find(([re]) => re.test(name))?.[1]
    if (!found || toppings.includes(found)) continue
    // Основа уже нарисована целиком — сверху её не повторяем
    if ((found === 'potato' && base === 'potato') || (found === 'greens' && base === 'greens')) {
      continue
    }
    if (found === 'cocoa' && (base === 'chocoCream' || vessel === 'mug' || vessel === 'glass')) {
      continue
    }
    // Яйцо в тесте блинов, кекса и запеканки не видно — сверху только украшения
    if (found === 'egg' && DOUGH.includes(vessel)) continue
    toppings.push(found)
    if (toppings.length === 4) break
  }

  return { vessel, base, toppings, fill: fillFor(vessel, sorted, t) }
}

/** Небольшой разброс поворота по названию — чтобы одинаковые продукты лежали по-разному. */
export function artSeed(title: string): number {
  let h = 0
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}
