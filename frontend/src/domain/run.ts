// Бег и ходьба по GPS: расстояние, фильтр скачков, темп, отрезки по километрам, калории.
// Чистые функции — без браузера, их удобно проверять тестами.

import type { Syncable, Timestamp } from './types'

export type RunKind = 'run' | 'walk'

export const RUN_KINDS: { value: RunKind; label: string }[] = [
  { value: 'run', label: 'Бег' },
  { value: 'walk', label: 'Ходьба' },
]

/** Цель пробежки: дистанция (м), время (с) или свободно. */
export type RunGoal =
  { type: 'free' } | { type: 'distance'; meters: number } | { type: 'time'; sec: number }

/** Интервалы «бег / шаг»: разминка шагом, потом бег и шаг по очереди. Время — в секундах. */
export interface RunIntervals {
  warmupSec: number
  runSec: number
  walkSec: number
  rounds: number
}

/** Точка маршрута: [широта, долгота, время, высота | null]. Массив — компактнее в базе. */
export type TrackPoint = [lat: number, lon: number, t: Timestamp, alt: number | null]

export interface Run extends Syncable {
  kind: RunKind
  goal: RunGoal
  status: 'active' | 'done'
  startedAt: Timestamp
  finishedAt: Timestamp | null
  /** Отрезки движения: пауза разрывает маршрут на части. */
  segments: TrackPoint[][]
  /** Время в движении без пауз, мс. Считается по меткам, а не таймером — переживает перезагрузку. */
  movingMs: number
  /** Когда началась текущая часть; null — на паузе или закончена. */
  resumedAt: Timestamp | null
  distanceM: number
  /** Набор высоты, м. */
  climbM: number
  /** Вес тела на момент пробежки — для калорий. */
  bodyKg: number
  /** Интервалы бег/шаг; нет — обычная пробежка. */
  intervals?: RunIntervals
}

export interface GpsFix {
  lat: number
  lon: number
  /** Точность в метрах. */
  accuracy: number
  alt: number | null
  t: Timestamp
}

/** Точки хуже этой точности (м) не пишем: в помещении и под деревьями GPS «гуляет». */
export const MAX_ACCURACY_M = 35
/** Быстрее этого человек не бежит и не идёт — значит, скачок GPS. м/с. */
const MAX_SPEED = { run: 8, walk: 3.5 } as const
/** Ближе этого точки не пишем — дрожание на месте даёт лишние метры. */
const MIN_STEP_M = 4

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

/** Расстояние между точками по поверхности Земли, м. */
export function distanceM(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[0] - a[0])
  const dLon = rad(b[1] - a[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Принять ли новую точку GPS. Отбрасываются неточные, слишком близкие (дрожание)
 * и невозможные по скорости (скачок через квартал).
 */
export function acceptFix(last: TrackPoint | undefined, fix: GpsFix, kind: RunKind): boolean {
  if (fix.accuracy > MAX_ACCURACY_M) return false
  if (!last) return true
  const d = distanceM([last[0], last[1]], [fix.lat, fix.lon])
  if (d < MIN_STEP_M) return false
  const sec = (fix.t - last[2]) / 1000
  if (sec <= 0) return false
  return d / sec <= MAX_SPEED[kind]
}

/** Длина части маршрута, м. */
export function segmentDistance(points: TrackPoint[]): number {
  let sum = 0
  for (let i = 1; i < points.length; i++) {
    sum += distanceM([points[i - 1][0], points[i - 1][1]], [points[i][0], points[i][1]])
  }
  return sum
}

/** Набор высоты, м: только подъёмы больше 2 м, чтобы шум высоты GPS не копился. */
export function climb(points: TrackPoint[]): number {
  let total = 0
  let base: number | null = null
  for (const p of points) {
    if (p[3] === null) continue
    if (base === null) base = p[3]
    else if (p[3] - base > 2) {
      total += p[3] - base
      base = p[3]
    } else if (p[3] < base) base = p[3]
  }
  return Math.round(total)
}

/** Время в движении с учётом текущей части, мс. */
export function movingTime(run: Pick<Run, 'movingMs' | 'resumedAt'>, now: Timestamp): number {
  return run.movingMs + (run.resumedAt !== null ? Math.max(0, now - run.resumedAt) : 0)
}

/** Темп, секунд на километр; null — пока не пробежали и 50 м. */
export function paceSecPerKm(distance: number, ms: number): number | null {
  if (distance < 50 || ms <= 0) return null
  return ms / 1000 / (distance / 1000)
}

/** «5:07» — темп мин/км; «—» — нет данных. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm > 3599) return '—'
  const s = Math.round(secPerKm)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** «3,48» — километры с двумя знаками. */
export function formatKm(meters: number): string {
  return (Math.floor(meters / 10) / 100).toFixed(2).replace('.', ',')
}

/** Калории: бег ≈ 1 ккал на кг на км, ходьба ≈ 0,5. Грубо, но честно для приложения. */
export function runCalories(kind: RunKind, meters: number, bodyKg: number): number {
  return Math.round((kind === 'run' ? 1 : 0.5) * bodyKg * (meters / 1000))
}

/**
 * Время каждого полного километра, секунды — для столбиков «темп по километрам».
 * Последний неполный километр не считается. Между частями маршрута (пауза) время не идёт.
 */
export function splits(segments: TrackPoint[][]): number[] {
  const result: number[] = []
  let carriedM = 0
  let carriedMs = 0
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      let d = distanceM([seg[i - 1][0], seg[i - 1][1]], [seg[i][0], seg[i][1]])
      let ms = seg[i][2] - seg[i - 1][2]
      while (carriedM + d >= 1000) {
        const need = 1000 - carriedM
        const part = ms * (need / d)
        result.push(Math.round((carriedMs + part) / 1000))
        d -= need
        ms -= part
        carriedM = 0
        carriedMs = 0
      }
      carriedM += d
      carriedMs += ms
    }
  }
  return result
}

/** Добавить точку в текущую часть маршрута, пересчитав расстояние и набор высоты. */
export function addFix(run: Run, fix: GpsFix): Run {
  if (run.resumedAt === null || run.status !== 'active') return run
  const segments = run.segments.length ? run.segments.map((s) => s) : [[]]
  const current = segments[segments.length - 1]
  const last = current[current.length - 1]
  if (!acceptFix(last, fix, run.kind)) return run
  const point: TrackPoint = [fix.lat, fix.lon, fix.t, fix.alt]
  const next = [...current, point]
  segments[segments.length - 1] = next
  const added = last ? distanceM([last[0], last[1]], [fix.lat, fix.lon]) : 0
  return {
    ...run,
    segments,
    distanceM: run.distanceM + added,
    climbM: segments.reduce((sum, s) => sum + climb(s), 0),
  }
}

export function pauseRun(run: Run, now: Timestamp): Run {
  if (run.resumedAt === null) return run
  return { ...run, movingMs: movingTime(run, now), resumedAt: null }
}

/** Продолжить после паузы: новая часть маршрута, чтобы не провести линию через паузу. */
export function resumeRun(run: Run, now: Timestamp): Run {
  if (run.resumedAt !== null || run.status !== 'active') return run
  return { ...run, resumedAt: now, segments: [...run.segments, []] }
}

export function finishRun(run: Run, now: Timestamp): Run {
  const paused = pauseRun(run, now)
  return {
    ...paused,
    status: 'done',
    finishedAt: now,
    segments: paused.segments.filter((s) => s.length > 0),
  }
}

/** Достигнута ли цель. */
export function goalReached(run: Run, now: Timestamp): boolean {
  if (run.goal.type === 'distance') return run.distanceM >= run.goal.meters
  if (run.goal.type === 'time') return movingTime(run, now) / 1000 >= run.goal.sec
  return false
}

/** Доля цели 0–1 для полоски; у свободной — null. */
export function goalProgress(run: Run, now: Timestamp): number | null {
  if (run.goal.type === 'distance') return Math.min(1, run.distanceM / run.goal.meters)
  if (run.goal.type === 'time') return Math.min(1, movingTime(run, now) / 1000 / run.goal.sec)
  return null
}

export interface RunTotals {
  count: number
  distanceM: number
  movingMs: number
  calories: number
  /** Самый быстрый полный километр, с. */
  bestKmSec: number | null
  longestM: number
}

export function runTotals(runs: Run[]): RunTotals {
  const done = runs.filter((r) => r.status === 'done' && r.deletedAt === null)
  const kms = done.flatMap((r) => (r.kind === 'run' ? splits(r.segments) : []))
  return {
    count: done.length,
    distanceM: done.reduce((s, r) => s + r.distanceM, 0),
    movingMs: done.reduce((s, r) => s + r.movingMs, 0),
    calories: done.reduce((s, r) => s + runCalories(r.kind, r.distanceM, r.bodyKg), 0),
    bestKmSec: kms.length ? Math.min(...kms) : null,
    longestM: done.reduce((m, r) => Math.max(m, r.distanceM), 0),
  }
}
