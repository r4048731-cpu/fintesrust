// Калькулятор блинов: какие блины повесить на каждую сторону грифа, чтобы набрать вес.

/** Обычный набор блинов в зале, кг, от тяжёлых к лёгким. */
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const

/** Варианты грифа: олимпийский, женский, лёгкий, без грифа (тренажёр с блинами). */
export const BAR_OPTIONS_KG = [20, 15, 10, 0] as const

export interface PlateLoad {
  /** Блины на одну сторону, от грифа наружу (тяжёлые ближе к центру). */
  perSide: number[]
  /** Сколько получится на самом деле: гриф + блины с двух сторон. */
  totalKg: number
  /** Сколько не хватает до цели, кг; 0 — набрано точно. Меньше нуля — цель легче грифа. */
  missingKg: number
}

/**
 * Блины на сторону жадным способом: каждый раз самый тяжёлый блин, который ещё влезает.
 * Для набора PLATES_KG это даёт наименьшее число блинов. Счёт в граммах, чтобы
 * 2,5 и 1,25 не копили ошибку дробей.
 */
export function plateLoad(
  targetKg: number,
  barKg: number,
  plates: readonly number[] = PLATES_KG,
): PlateLoad {
  const g = (kg: number) => Math.round(kg * 1000)
  let side = Math.floor((g(targetKg) - g(barKg)) / 2)
  const perSide: number[] = []
  if (side > 0) {
    for (const p of plates) {
      while (side >= g(p)) {
        perSide.push(p)
        side -= g(p)
      }
    }
  }
  const totalKg = barKg + 2 * perSide.reduce((s, p) => s + p, 0)
  return { perSide, totalKg, missingKg: Math.round((targetKg - totalKg) * 1000) / 1000 }
}

/** «2 × 20, 2,5» — блины на сторону, одинаковые подряд собраны вместе. */
export function groupPlates(perSide: number[]): { kg: number; count: number }[] {
  const out: { kg: number; count: number }[] = []
  for (const kg of perSide) {
    const last = out[out.length - 1]
    if (last && last.kg === kg) last.count++
    else out.push({ kg, count: 1 })
  }
  return out
}
