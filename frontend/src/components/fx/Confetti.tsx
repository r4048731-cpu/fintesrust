import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motionAllowed } from './motion'
import styles from './Confetti.module.css'

const COLORS = ['#3563e9', '#7c3aed', '#db2777', '#f59e0b', '#12a06a', '#0b9fb4']
const PIECES = 48
/** Сколько живёт салют, мс; чуть больше самой долгой анимации в CSS. */
const LIFETIME_MS = 3200

interface Piece {
  left: number
  delay: number
  duration: number
  drift: number
  spin: number
  color: string
  round: boolean
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 400,
    duration: 1800 + Math.random() * 1000,
    drift: (Math.random() - 0.5) * 160,
    spin: 360 + Math.random() * 720,
    color: COLORS[i % COLORS.length],
    round: Math.random() < 0.3,
  }))
}

/** Салют из конфетти поверх экрана, один раз при показе. Без анимаций не рисуется вовсе. */
export function Confetti() {
  const [pieces, setPieces] = useState<Piece[] | null>(() =>
    motionAllowed() ? makePieces() : null,
  )

  useEffect(() => {
    if (!pieces) return
    const timer = setTimeout(() => setPieces(null), LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [pieces])

  if (!pieces) return null
  return createPortal(
    <div className={styles.confetti} aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={p.round ? styles.round : undefined}
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>,
    document.body,
  )
}
