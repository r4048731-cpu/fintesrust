import { toISODate } from '../../domain/metrics'
import { newId } from '../../domain/id'
import type { ID, ISODate, ProgressPhoto } from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'

export interface PhotoInput {
  image: string
  thumb: string
  date?: ISODate
}

export function photosRepo(db: FitnessDB, clock: Clock) {
  return {
    /** Живые снимки от старых к новым; за один день — в порядке добавления. */
    async list(): Promise<ProgressPhoto[]> {
      const rows = await db.photos.toArray()
      return rows
        .filter((p) => p.deletedAt === null)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    },

    async add({ image, thumb, date }: PhotoInput): Promise<ProgressPhoto> {
      const now = clock()
      const photo: ProgressPhoto = {
        id: newId(),
        date: date ?? toISODate(new Date(now)),
        image,
        thumb,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await db.photos.add(photo)
      return photo
    },

    async setDate(id: ID, date: ISODate): Promise<void> {
      await db.photos.update(id, { date, updatedAt: clock() })
    },

    /** Удалённый снимок стирается сразу: держать фото тела в «корзине» незачем. */
    async remove(id: ID): Promise<void> {
      await db.photos.update(id, { image: '', thumb: '', deletedAt: clock(), updatedAt: clock() })
    },
  }
}
