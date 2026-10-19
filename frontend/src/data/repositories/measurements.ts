import { toISODate } from '../../domain/metrics'
import { newId } from '../../domain/id'
import {
  MEASURE_KEYS,
  type ID,
  type ISODate,
  type MeasureKey,
  type Measurement,
} from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'

export const MEASURE_LIMITS = { min: 10, max: 250 } as const

/** Ошибка ввода: текст показывается пользователю как есть. */
export class MeasurementError extends Error {}

export function measurementsRepo(db: FitnessDB, clock: Clock) {
  return {
    /** Записи от старых к новым. */
    async list(): Promise<Measurement[]> {
      const rows = await db.measurements.orderBy('date').toArray()
      return rows.filter((r) => r.deletedAt === null)
    },

    /**
     * Записать замеры за день (по умолчанию — за сегодня). Повторная запись за тот же день
     * заменяет прежнюю. Пустые замеры не сохраняются; совсем пустая запись — ошибка.
     */
    async record(
      values: Partial<Record<MeasureKey, number | null>>,
      date: ISODate = toISODate(new Date(clock())),
    ): Promise<Measurement> {
      const clean: Measurement['values'] = {}
      for (const key of MEASURE_KEYS) {
        const v = values[key]
        if (v === null || v === undefined || v === 0) continue
        const cm = Math.round(v * 10) / 10
        if (!(cm >= MEASURE_LIMITS.min && cm <= MEASURE_LIMITS.max)) {
          throw new MeasurementError(
            `Замер должен быть от ${MEASURE_LIMITS.min} до ${MEASURE_LIMITS.max} см`,
          )
        }
        clean[key] = cm
      }
      if (!Object.keys(clean).length) throw new MeasurementError('Заполните хотя бы один замер')
      const existing = (await db.measurements.where('date').equals(date).toArray()).find(
        (r) => r.deletedAt === null,
      )
      const row: Measurement = {
        id: existing?.id ?? newId(),
        date,
        values: clean,
        updatedAt: clock(),
        deletedAt: null,
      }
      await db.measurements.put(row)
      return row
    },

    async remove(id: ID): Promise<void> {
      await db.measurements.update(id, { deletedAt: clock(), updatedAt: clock() })
    },
  }
}

/** Значения одного замера по датам — только записи, где он есть. */
export function measureSeries(
  rows: Measurement[],
  key: MeasureKey,
): { date: ISODate; cm: number }[] {
  return rows.flatMap((r) =>
    r.values[key] !== undefined ? [{ date: r.date, cm: r.values[key] }] : [],
  )
}

/** Последнее значение и изменение с первого замера, см. */
export function measureTrend(
  rows: Measurement[],
  key: MeasureKey,
): { cm: number; change: number | null } | null {
  const s = measureSeries(rows, key)
  if (!s.length) return null
  const last = s[s.length - 1].cm
  return { cm: last, change: s.length > 1 ? Math.round((last - s[0].cm) * 10) / 10 : null }
}

/** Талия / рост: меньше 0,5 — норма (оценка жира на животе, не зависит от веса). */
export function waistToHeight(waistCm: number, heightCm: number): number {
  return Math.round((waistCm / heightCm) * 100) / 100
}
