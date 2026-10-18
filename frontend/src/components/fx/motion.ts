/** Анимации нет в тестах (там нет matchMedia) и при системной настройке «уменьшить движение». */
export function motionAllowed(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
