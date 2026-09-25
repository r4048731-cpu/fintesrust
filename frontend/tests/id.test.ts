import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from '../src/domain/id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('работает на незащищённом адресе, где нет crypto.randomUUID (телефон по http://192.168…)', () => {
    vi.stubGlobal('isSecureContext', false)
    const ids = new Set(Array.from({ length: 1000 }, newId))
    expect(ids.size).toBe(1000)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })

  it('на защищённом адресе даёт тот же формат', () => {
    expect(newId()).toMatch(UUID_V4)
  })
})
