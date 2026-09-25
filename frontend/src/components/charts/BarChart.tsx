import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceDomain } from './scale'
import styles from './charts.module.css'

export interface Bar {
  label: string
  value: number
  /** Строка во всплывающей подсказке, например «2 тренировки». */
  detail?: string
}

interface Props {
  bars: Bar[]
  format: (value: number) => string
  ariaLabel: string
  /** Столбец, выделенный цветом, — обычно текущая неделя. */
  highlight?: number
}

const W = 340
const H = 170
const PAD = { l: 34, r: 8, t: 12, b: 24 }
const GAP = 4

/** Столбцы по периодам (тоннаж по неделям). Касание столбца показывает его значение. */
export function BarChart({ bars, format, ariaLabel, highlight = bars.length - 1 }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { hi, ticks } = niceDomain([0, ...bars.map((b) => b.value)], 3)
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const slot = innerW / bars.length
  const barW = slot - GAP
  const y = (v: number) => PAD.t + innerH * (1 - v / (hi || 1))
  const base = PAD.t + innerH

  function pick(e: PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const px = ((e.clientX - rect.left) * W) / rect.width
    setActive(Math.max(0, Math.min(bars.length - 1, Math.floor((px - PAD.l) / slot))))
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const d = e.key === 'ArrowLeft' ? -1 : 1
      setActive((a) => Math.max(0, Math.min(bars.length - 1, (a ?? bars.length - 1) + d)))
    } else if (e.key === 'Escape') setActive(null)
  }

  /** Столбец со скруглённым верхом 4px, прижатый к нулевой линии. */
  const barPath = (i: number, v: number) => {
    const x0 = PAD.l + i * slot + GAP / 2
    const top = y(v)
    const r = Math.min(4, (base - top) / 2, barW / 2)
    return `M${x0} ${base} V${top + r} Q${x0} ${top} ${x0 + r} ${top} H${x0 + barW - r} Q${x0 + barW} ${top} ${x0 + barW} ${top + r} V${base} Z`
  }

  return (
    <div className={styles.chart}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className={styles.tick}>
              {format(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => (
          <g key={i}>
            {b.value > 0 && (
              <path
                d={barPath(i, b.value)}
                fill="var(--chart-1)"
                opacity={i === highlight || i === active ? 1 : 0.4}
              />
            )}
            {(i % 3 === 0 || i === bars.length - 1) && (
              <text
                x={PAD.l + i * slot + slot / 2}
                y={H - 6}
                textAnchor="middle"
                className={styles.tick}
              >
                {b.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {active !== null && (
        <div
          className={styles.tooltip}
          style={{
            left: `clamp(70px, ${((PAD.l + (active + 0.5) * slot) / W) * 100}%, calc(100% - 70px))`,
            top: `${(y(bars[active].value) / H) * 100}%`,
          }}
          role="status"
        >
          <b>{bars[active].label}</b>
          <span>{format(bars[active].value)}</span>
          {bars[active].detail && <span>{bars[active].detail}</span>}
        </div>
      )}
    </div>
  )
}
