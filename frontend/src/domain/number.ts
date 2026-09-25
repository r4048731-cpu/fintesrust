// Ввод чисел: на телефоне в русской раскладке десятичный разделитель — запятая.

/** Разбирает «62,5», «62.5», « 60 ». Пустая строка или мусор — null. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(normalized)) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** 62.5 → «62,5», 60 → «60», 1.25 → «1,25». Не больше двух знаков после запятой. */
export function formatDecimal(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/**
 * Шаг счётчика: `value + direction × step` с ограничением [min, max].
 * Округление убирает ошибки вида 0.1 + 0.2 = 0.30000000000000004.
 */
export function stepValue(
  value: number,
  direction: 1 | -1,
  step: number,
  min = 0,
  max = Number.POSITIVE_INFINITY,
): number {
  const next = Math.round((value + direction * step) * 1000) / 1000
  return Math.min(max, Math.max(min, next))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const integerFormat = new Intl.NumberFormat('ru', { maximumFractionDigits: 0 })

/** Целое с разделителем тысяч: 12500 → «12 500». Для тоннажа. */
export function formatInteger(n: number): string {
  return integerFormat.format(Math.round(n))
}
