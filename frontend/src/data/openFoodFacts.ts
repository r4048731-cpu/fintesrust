// Продукты по штрихкоду из Open Food Facts — открытой базы, которую заполняют сами покупатели.
// Ключ не нужен; запрос уходит с телефона напрямую, в нём только штрихкод.

import { roundNutrients } from '../domain/nutrition'
import type { BarcodeFood } from '../domain/types'

const FIELDS = 'product_name,product_name_ru,brands,nutriments,serving_quantity'
const KJ_PER_KCAL = 4.184

/** Штрихкод товара: EAN-8, UPC-A, EAN-13 или EAN-14 — только цифры. */
export const isBarcode = (code: string) => /^\d{8}$|^\d{12,14}$/.test(code)

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}

/** Ответ Open Food Facts → продукт; null — товара нет или у него не указаны калории. */
export function parseProduct(code: string, json: unknown): BarcodeFood | null {
  const p = (json as { product?: Record<string, unknown> } | null)?.product
  if (!p) return null
  const n = (p.nutriments ?? {}) as Record<string, unknown>
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) ?? NaN) / KJ_PER_KCAL
  if (!Number.isFinite(kcal)) return null
  const title = String(p.product_name_ru || p.product_name || '').trim()
  const brand = String(p.brands ?? '')
    .split(',')[0]
    .trim()
  const name = [title || 'Продукт', brand && !title.includes(brand) ? brand : '']
    .filter(Boolean)
    .join(', ')
    .slice(0, 80)
  const serving = num(p.serving_quantity)
  return {
    code,
    name,
    per100: roundNutrients({
      calories: kcal,
      protein: num(n.proteins_100g) ?? 0,
      fat: num(n.fat_100g) ?? 0,
      carbs: num(n.carbohydrates_100g) ?? 0,
    }),
    servingG: serving && serving <= 5000 ? Math.round(serving) : null,
  }
}

export class LookupError extends Error {}

/** Найти продукт; null — в базе его нет. Без сети — LookupError. */
export async function lookupBarcode(code: string, fetchFn = fetch): Promise<BarcodeFood | null> {
  let res: Response
  try {
    res = await fetchFn(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`,
    )
  } catch {
    throw new LookupError('Нет связи с базой продуктов — проверьте интернет')
  }
  if (res.status === 404) return null
  if (!res.ok) throw new LookupError('База продуктов не ответила — попробуйте позже')
  return parseProduct(code, await res.json())
}
