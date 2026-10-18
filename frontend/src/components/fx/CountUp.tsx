import { useEffect, useRef, useState } from 'react'
import { motionAllowed } from './motion'

interface Props {
  value: number
  /** Как показать промежуточное и итоговое число. */
  format: (value: number) => string
  /** Длительность набегания, мс. */
  duration?: number
}

/** Число «набегает» от нуля при первом показе и плавно доезжает до нового значения при смене. */
export function CountUp({ value, format, duration = 700 }: Props) {
  const [animate] = useState(motionAllowed)
  const [shown, setShown] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    if (!animate) return
    const from = current.current
    const t0 = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - k) ** 3
      current.current = from + (value - from) * eased
      setShown(current.current)
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate, value, duration])

  return <>{format(animate ? shown : value)}</>
}
