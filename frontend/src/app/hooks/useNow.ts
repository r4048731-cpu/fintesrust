import { useEffect, useState } from 'react'

/** Текущее время, обновляется раз в `intervalMs`. Для часов тренировки и таймера отдыха. */
export function useNow(intervalMs = 250, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const tick = () => setNow(Date.now())
    // Первое обновление сразу, а не через интервал: иначе после паузы часы секунду показывают старое время
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, intervalMs)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [intervalMs, enabled])
  return now
}
