import { newDay } from '../../domain/programs'
import type { ID, Program, ProgramDay } from '../../domain/types'
import type { FitnessDB } from '../db'
import type { Clock } from './clock'
import { metaRepo } from './meta'
import { newId } from '../../domain/id'

const collator = new Intl.Collator('ru')

export function programsRepo(db: FitnessDB, clock: Clock) {
  const meta = metaRepo(db)

  async function list(): Promise<Program[]> {
    const rows = await db.programs.toArray()
    return rows.filter((p) => p.deletedAt === null).sort((a, b) => collator.compare(a.name, b.name))
  }

  async function getAlive(id: ID): Promise<Program | undefined> {
    const p = await db.programs.get(id)
    return p && p.deletedAt === null ? p : undefined
  }

  async function save(program: Program): Promise<Program> {
    if (!program.days.length) throw new Error('В программе должен быть хотя бы один день')
    const next = { ...program, name: program.name.trim() || 'Без названия', updatedAt: clock() }
    await db.programs.put(next)
    return next
  }

  return {
    list,
    get: getAlive,
    save,

    /** Новая программа с одним пустым днём. Первая созданная программа становится активной. */
    async create(name = 'Новая программа'): Promise<Program> {
      const program: Program = {
        id: newId(),
        name,
        days: [newDay(0)],
        updatedAt: clock(),
        deletedAt: null,
      }
      await db.transaction('rw', db.programs, db.meta, async () => {
        await db.programs.add(program)
        if (!(await meta.get('activeProgramId'))) await meta.set('activeProgramId', program.id)
      })
      return program
    },

    async duplicate(id: ID): Promise<Program> {
      const source = await getAlive(id)
      if (!source) throw new Error(`Программа ${id} не найдена`)
      const copy: Program = {
        ...structuredClone(source),
        id: newId(),
        name: `${source.name} (копия)`,
        days: source.days.map((d) => ({ ...structuredClone(d), id: newId() })),
        updatedAt: clock(),
        deletedAt: null,
      }
      await db.programs.add(copy)
      return copy
    },

    /** Мягкое удаление. Если программа была активной, активной становится первая из оставшихся. */
    async remove(id: ID): Promise<void> {
      await db.transaction('rw', db.programs, db.meta, async () => {
        await db.programs.update(id, { deletedAt: clock(), updatedAt: clock() })
        if ((await meta.get('activeProgramId')) === id) {
          const rest = await list()
          await meta.set('activeProgramId', rest[0]?.id ?? null)
        }
      })
    },

    async getActive(): Promise<Program | null> {
      const id = await meta.get('activeProgramId')
      if (id) {
        const p = await getAlive(id)
        if (p) return p
      }
      return (await list())[0] ?? null
    },

    async setActive(id: ID): Promise<void> {
      if (!(await getAlive(id))) throw new Error(`Программа ${id} не найдена`)
      await meta.set('activeProgramId', id)
    },

    /** Следующий день программы по кругу. */
    async nextDay(programId: ID): Promise<{ day: ProgramDay; index: number } | null> {
      const program = await getAlive(programId)
      if (!program?.days.length) return null
      const stored = (await meta.get('nextDayIndex'))[programId] ?? 0
      const index = stored % program.days.length
      return { day: program.days[index], index }
    },

    /** После тренировки по дню `dayId` следующим становится день после него. */
    async advanceAfter(programId: ID, dayId: ID): Promise<void> {
      const program = await getAlive(programId)
      if (!program) return
      const i = program.days.findIndex((d) => d.id === dayId)
      if (i < 0) return
      const next = {
        ...(await meta.get('nextDayIndex')),
        [programId]: (i + 1) % program.days.length,
      }
      await meta.set('nextDayIndex', next)
    },
  }
}
