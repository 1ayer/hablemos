import { describe, expect, it } from 'vitest'
import { BACKUP_KEY, STATE_KEY, initialState, load, save, validate } from './state'

function memory(init: Record<string, string> = {}, failWrites = false) {
  const data = { ...init }
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      if (failWrites) throw new DOMException('full', 'QuotaExceededError')
      data[k] = v
    },
  }
}

describe('validate', () => {
  it('accepts the initial state and a round-tripped one', () => {
    const s = { ...initialState(), xp: 40, completedLessons: ['u1-l1'], cards: { a: { reps: 1, ease: 2.5, interval: 1, due: '2026-11-23' } } }
    expect(validate(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })
  it.each([
    ['newer version', { version: 2 }],
    ['negative xp', { xp: -1 }],
    ['six hearts', { hearts: { count: 6, refillStart: null } }],
    ['bad date', { streak: { count: 1, lastDate: '22/11/2026' } }],
    ['bad card', { cards: { a: { reps: 0, ease: 9, interval: 0, due: '2026-11-23' } } }],
    ['lessons not strings', { completedLessons: [1] }],
    ['missing settings', { settings: undefined }],
  ])('rejects %s', (_, patch) => {
    expect(validate({ ...initialState(), ...patch })).toBeNull()
  })
})

describe('load and save', () => {
  it('starts fresh when nothing is saved', () => {
    expect(load(memory())).toEqual({ state: initialState(), recovered: false })
  })
  it('round-trips through storage', () => {
    const m = memory()
    const s = { ...initialState(), xp: 25 }
    expect(save(m, s)).toBe(true)
    expect(load(m)).toEqual({ state: s, recovered: false })
  })
  it('backs up unreadable data before starting fresh', () => {
    const m = memory({ [STATE_KEY]: '{not json' })
    expect(load(m)).toEqual({ state: initialState(), recovered: true })
    expect(m.data[BACKUP_KEY]).toBe('{not json')
  })
  it('reports a refused write instead of throwing', () => {
    expect(save(memory({}, true), initialState())).toBe(false)
  })
})
