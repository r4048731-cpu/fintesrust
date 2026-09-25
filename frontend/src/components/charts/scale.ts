/** «Красивый» шаг сетки: 1, 2, 2,5 или 5 × 10ⁿ. */
export function niceStep(range: number, targetTicks = 4): number {
  if (range <= 0) return 1
  const raw = range / targetTicks
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

/**
 * Границы оси и деления с запасом, чтобы линия не прилипала к краю.
 * Ниже нуля не опускается: вес и повторы не бывают отрицательными.
 */
export function niceDomain(
  values: number[],
  targetTicks = 4,
): { lo: number; hi: number; ticks: number[] } {
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (!Number.isFinite(min)) {
    min = 0
    max = 1
  }
  if (min === max) {
    const pad = Math.max(1, Math.abs(max) * 0.1)
    min -= pad
    max += pad
  }
  const step = niceStep(max - min, targetTicks)
  const lo = Math.max(0, Math.floor(min / step) * step)
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { lo, hi, ticks }
}
