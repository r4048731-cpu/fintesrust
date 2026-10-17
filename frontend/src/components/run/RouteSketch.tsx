import type { TrackPoint } from '../../domain/run'

/** Рисунок маршрута без карты — для списка пробежек: работает и без интернета. */
export function RouteSketch({ segments, size = 56 }: { segments: TrackPoint[][]; size?: number }) {
  const all = segments.flat()
  if (all.length < 2) return <svg width={size} height={size} aria-hidden="true" />
  const lat0 = all[0][0]
  const k = Math.cos((lat0 * Math.PI) / 180)
  const xs = all.map((p) => p[1] * k)
  const ys = all.map((p) => -p[0])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1
  const pad = 6
  const scale = (size - pad * 2) / span
  const toXY = (p: TrackPoint) =>
    `${(pad + (p[1] * k - minX) * scale).toFixed(1)},${(pad + (-p[0] - minY) * scale).toFixed(1)}`
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {segments
        .filter((s) => s.length > 1)
        .map((s, i) => (
          <polyline
            key={i}
            points={s.map(toXY).join(' ')}
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      <defs>
        <linearGradient id="routeGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3563e9" />
          <stop offset="0.5" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#db2777" />
        </linearGradient>
      </defs>
    </svg>
  )
}
