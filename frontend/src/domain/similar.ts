// «Заменить на похожее»: тренажёр занят или нет нужного инвентаря — что сделать вместо.

import { slotMates } from './builder'
import { normalizeName } from './exercises'
import type { Exercise } from './types'

/** Чем выполняется — по названию: так работает и для своих упражнений. */
export function gearLabel(e: Pick<Exercise, 'name' | 'type'>): string | null {
  const n = normalizeName(e.name)
  if (/штанг|гриф|ez-/.test(n)) return 'Штанга'
  if (/гантел|гантели|гир/.test(n)) return 'Гантели'
  if (/блок|кроссовер|канат/.test(n)) return 'Блок'
  if (/тренаж|смита|гакк|гравитрон|пек-дек|бабочк|жим ногами/.test(n)) return 'Тренажёр'
  if (/подтягиван|в висе|турник/.test(n) && !/австралийск/.test(n)) return 'Турник'
  if (e.type !== 'weight') return 'Без инвентаря'
  return null
}

/**
 * Похожие упражнения, лучшие первыми: на то же движение (из подбора программы),
 * потом близкие к ним, потом той же группы мышц и того же типа, потом просто той же группы.
 */
export function similarExercises(target: Exercise, all: Exercise[], limit = 8): Exercise[] {
  const alive = all.filter((e) => e.deletedAt === null && e.id !== target.id)
  const byId = new Map(alive.map((e) => [e.id, e]))
  const out: Exercise[] = []
  const add = (e: Exercise | undefined) => {
    if (e && !out.includes(e) && out.length < limit) out.push(e)
  }
  // то же движение, затем «похожие на похожие»: у жима лёжа через отжимания — жимы на наклонной
  const mates = slotMates(target.id.replace(/^builtin-/, ''))
  for (const id of mates) add(byId.get(`builtin-${id}`))
  for (const id of mates.flatMap(slotMates)) {
    const e = byId.get(`builtin-${id}`)
    if (e?.muscle === target.muscle) add(e)
  }
  const sameMuscle = alive
    .filter((e) => e.muscle === target.muscle)
    .sort((a, b) => Number(b.type === target.type) - Number(a.type === target.type))
  for (const e of sameMuscle) add(e)
  return out
}
