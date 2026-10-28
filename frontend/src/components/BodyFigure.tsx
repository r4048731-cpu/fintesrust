import type { MeasureKey } from '../domain/types'
import styles from './BodyMeasurements.module.css'

/** Где на фигуре мерить: точка и короткая черта к краю. Координаты — в системе viewBox 0 0 100 240. */
const SPOTS: Record<MeasureKey, { x: number; y: number }> = {
  shoulders: { x: 50, y: 47 },
  chest: { x: 50, y: 62 },
  biceps: { x: 23, y: 74 },
  waist: { x: 50, y: 92 },
  belly: { x: 50, y: 106 },
  hips: { x: 50, y: 124 },
  thigh: { x: 41, y: 150 },
}

/** Условная фигура человека для замеров: выбранный замер подсвечен. Без фото — одинаково в обеих темах. */
export function BodyFigure({ active }: { active: MeasureKey }) {
  return (
    <svg className={styles.figure} viewBox="0 0 100 240" aria-hidden="true">
      <g className={styles.body}>
        <circle cx="50" cy="20" r="12" />
        <rect x="45" y="30" width="10" height="10" rx="3" />
        <path d="M30 44 Q50 38 70 44 L72 70 Q70 96 66 112 L67 128 Q50 136 33 128 L34 112 Q30 96 28 70 Z" />
        <g className={styles.limbs}>
          <polyline points="31,47 23,78 19,118" />
          <polyline points="69,47 77,78 81,118" />
          <polyline points="42,128 40,180 39,228" />
          <polyline points="58,128 60,180 61,228" />
        </g>
      </g>
      {(Object.keys(SPOTS) as MeasureKey[]).map((key) => {
        const { x, y } = SPOTS[key]
        return (
          <circle
            key={key}
            cx={x}
            cy={y}
            r={key === active ? 4.5 : 2.5}
            className={key === active ? styles.spotActive : styles.spot}
          />
        )
      })}
    </svg>
  )
}
