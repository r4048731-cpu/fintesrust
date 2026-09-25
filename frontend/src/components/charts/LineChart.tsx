import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceDomain } from './scale'
import styles from './charts.module.css'

export interface LineSeries {
  key: string
  name: string
  /** CSS-цвет, обычно токен темы: var(--chart-1). */
  color: string
  /** Пунктир — вторая примета серии, чтобы линии различались не только цветом. */
  dashed?: boolean
}

export interface LinePoint {
  label: string
  values: Record<string, number>
}

interface Props {
  points: LinePoint[]
  series: LineSeries[]
  format: (value: number) => string
  /** Подпись для экранного диктора. */
  ariaLabel: string
  /** Какие подписи оси X показать: по умолчанию первая, средняя и последняя. */
  xLabels?: (points: LinePoint[]) => number[]
}

const W = 340
const H = 190
const PAD = { l: 38, r: 14, t: 14, b: 26 }

/**
 * Линейный график по тренировкам: точки идут равномерно по порядку, а не по календарю,
 * чтобы перерыв в неделю не сжимал остальные тренировки. Касание или наведение показывает
 * значения ближайшей тренировки, стрелки клавиатуры переключают тренировки.
 */
export function LineChart({ points, series, format, ariaLabel, xLabels }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gradId = useId()

  const all = points.flatMap((p) => series.map((s) => p.values[s.key]))
  const { lo, hi, ticks } = niceDomain(all)
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const x = (i: number) =>
    points.length === 1 ? PAD.l + innerW / 2 : PAD.l + (i * innerW) / (points.length - 1)
  const y = (v: number) => PAD.t + innerH * (1 - (v - lo) / (hi - lo || 1))
  const labelIdx = xLabels?.(points) ?? [
    ...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  ]
  const last = points.length - 1
  const pathOf = (key: string) =>
    points
      .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.values[key]).toFixed(1)}`)
      .join(' ')

  // Подписи значений у последней точки: разводятся, если оказались слишком близко
  const endLabels = series
    .map((s) => ({ s, v: points[last].values[s.key], y: y(points[last].values[s.key]) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].y - endLabels[i - 1].y < 14) endLabels[i].y = endLabels[i - 1].y + 14
  }

  function pick(e: PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const px = ((e.clientX - rect.left) * W) / rect.width
    const i = points.length === 1 ? 0 : Math.round(((px - PAD.l) / innerW) * (points.length - 1))
    setActive(Math.max(0, Math.min(last, i)))
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const d = e.key === 'ArrowLeft' ? -1 : 1
      setActive((a) => Math.max(0, Math.min(last, (a ?? last) + d)))
    } else if (e.key === 'Escape') setActive(null)
  }

  const tipLeft = active === null ? 0 : (x(active) / W) * 100
  const tipTop =
    active === null
      ? 0
      : (Math.min(...series.map((s) => y(points[active].values[s.key]))) / H) * 100

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
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={series[0].color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className={styles.tick}>
              {format(t)}
            </text>
          </g>
        ))}
        {labelIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor={
              points.length > 1 && i === 0
                ? 'start'
                : points.length > 1 && i === last
                  ? 'end'
                  : 'middle'
            }
            className={styles.tick}
          >
            {points[i].label}
          </text>
        ))}

        {points.length > 1 && (
          <path
            d={`${pathOf(series[0].key)} L${x(last)} ${PAD.t + innerH} L${x(0)} ${PAD.t + innerH} Z`}
            fill={`url(#${gradId})`}
          />
        )}
        {series.map((s) => (
          <path
            key={s.key}
            d={pathOf(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.dashed ? '5 4' : undefined}
          />
        ))}
        {points.length <= 24 &&
          series.map((s) =>
            points.map((p, i) => (
              <circle
                key={`${s.key}${i}`}
                cx={x(i)}
                cy={y(p.values[s.key])}
                r={i === last ? 4.5 : 2.5}
                fill={s.color}
                className={styles.dot}
              />
            )),
          )}
        {endLabels.map(({ s, v, y: ly }) => (
          <text key={s.key} x={x(last) - 8} y={ly - 8} textAnchor="end" className={styles.endLabel}>
            {format(v)}
          </text>
        ))}

        {active !== null && (
          <g aria-hidden="true">
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.t}
              y2={PAD.t + innerH}
              className={styles.crosshair}
            />
            {series.map((s) => (
              <circle
                key={s.key}
                cx={x(active)}
                cy={y(points[active].values[s.key])}
                r={5}
                fill={s.color}
                className={styles.dot}
              />
            ))}
          </g>
        )}
      </svg>

      {active !== null && (
        <div
          className={styles.tooltip}
          style={{ left: `clamp(70px, ${tipLeft}%, calc(100% - 70px))`, top: `${tipTop}%` }}
          role="status"
        >
          <b>{points[active].label}</b>
          {series.map((s) => (
            <span key={s.key} className={styles.tipRow}>
              <i
                className={s.dashed ? styles.swatchDashed : styles.swatch}
                style={{ borderColor: s.color }}
              />
              {s.name}: {format(points[active].values[s.key])}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Легенда: для двух и более линий. */
export function ChartLegend({ series }: { series: LineSeries[] }) {
  return (
    <ul className={styles.legend}>
      {series.map((s) => (
        <li key={s.key}>
          <i
            className={s.dashed ? styles.swatchDashed : styles.swatch}
            style={{ borderColor: s.color }}
          />
          {s.name}
        </li>
      ))}
    </ul>
  )
}
