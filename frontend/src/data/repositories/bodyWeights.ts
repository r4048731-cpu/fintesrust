import { toISODate } from '../../domain/metrics'
import { newId } from '../../domain/id'
import type { BodyWeight, ID, ISODate, WeighTime } from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'

export const BODY_WEIGHT_LIMITS = { min: 20, max: 400 } as const

/** Поправка за взвешивание днём, вечером или после тренировки (ТЗ 9.7: всегда 1,5 кг). */
export const LATER_CORRECTION_KG = 1.5

/** Итоговый вес: утром — как на весах, позже — минус поправка. */
export function correctedWeight(measuredKg: number, timeOfDay: WeighTime): number {
  const kg = timeOfDay === 'later' ? measuredKg - LATER_CORRECTION_KG : measuredKg
  return Math.round(kg * 10) / 10
}

export function bodyWeightsRepo(db: FitnessDB, clock: Clock) {
  async function alive(): Promise<BodyWeight[]> {
    const rows = await db.bodyWeights.orderBy('date').toArray()
    return rows.filter((r) => r.deletedAt === null)
  }

  return {
    /** Записи от старых к новым. */
    list: alive,

    /**
     * Записать вес за день (по умолчанию — за сегодня). `timeOfDay` = later вычитает 1,5 кг.
     * Повторная запись за тот же день заменяет прежнюю: в графике одна точка на день.
     */
    async record(
      measuredKg: number,
      timeOfDay: WeighTime = 'morning',
      date: ISODate = toISODate(new Date(clock())),
    ): Promise<BodyWeight> {
      const measured = Math.round(measuredKg * 10) / 10
      if (!(measured >= BODY_WEIGHT_LIMITS.min && measured <= BODY_WEIGHT_LIMITS.max)) {
        throw new Error(
          `Вес тела должен быть от ${BODY_WEIGHT_LIMITS.min} до ${BODY_WEIGHT_LIMITS.max} кг`,
        )
      }
      const existing = (await db.bodyWeights.where('date').equals(date).toArray()).find(
        (r) => r.deletedAt === null,
      )
      const row: BodyWeight = {
        id: existing?.id ?? newId(),
        date,
        weightKg: correctedWeight(measured, timeOfDay),
        measuredKg: measured,
        timeOfDay,
        updatedAt: clock(),
        deletedAt: null,
      }
      await db.bodyWeights.put(row)
      return row
    },

    async remove(id: ID): Promise<void> {
      await db.bodyWeights.update(id, { deletedAt: clock(), updatedAt: clock() })
    },
  }
}

/** Изменение веса за последние `days` дней: последняя запись минус самая ранняя в этом окне. */
export function bodyWeightChange(rows: BodyWeight[], days: number, today: ISODate): number | null {
  if (rows.length < 2) return null
  const [y, m, d] = today.split('-').map(Number)
  const from = toISODate(new Date(y, m - 1, d - days))
  const window = rows.filter((r) => r.date >= from)
  if (window.length < 2) return null
  return Math.round((window[window.length - 1].weightKg - window[0].weightKg) * 10) / 10
}

export interface WeightDay {
  row: BodyWeight
  /** Разница с предыдущей записью, кг: минус — похудел, плюс — набрал. У первой записи — null. */
  diffKg: number | null
}

/** Записи от новых к старым, у каждой — разница с предыдущей по времени записью. */
export function weightDays(rows: BodyWeight[]): WeightDay[] {
  return rows
    .map((row, i) => ({
      row,
      diffKg: i === 0 ? null : Math.round((row.weightKg - rows[i - 1].weightKg) * 10) / 10,
    }))
    .reverse()
}
