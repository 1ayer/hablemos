import { describe, expect, it } from 'vitest'
import { distractors } from '../lib/lesson'
import { tokens } from '../lib/grade'
import { EXERCISE_TYPES, lessons, units } from '.'

const all = lessons.flatMap((l) => l.items)

describe('curriculum', () => {
  it('has unique ids', () => {
    const ids = [...units.map((u) => u.id), ...lessons.map((l) => l.id), ...all.map((i) => i.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has 8–10 well-formed items per lesson', () => {
    for (const l of lessons) {
      expect(l.items.length, l.id).toBeGreaterThanOrEqual(8)
      expect(l.items.length, l.id).toBeLessThanOrEqual(10)
      for (const i of l.items) {
        expect(i.es.trim() && i.ko.trim(), i.id).toBeTruthy()
        for (const t of i.types ?? []) expect(EXERCISE_TYPES, i.id).toContain(t)
        if (i.types?.includes('assemble')) expect(tokens(i.es).length, i.id).toBeGreaterThanOrEqual(2)
        for (const a of i.accept_es ?? []) expect(a.trim(), i.id).toBeTruthy()
      }
    }
  })

  it('can build choice options for every item from what was learned so far', () => {
    lessons.forEach((l, n) => {
      const pool = lessons.slice(0, n + 1).flatMap((x) => x.items)
      for (const i of l.items) expect(distractors(i, pool, 3, Math.random).length, i.id).toBeGreaterThanOrEqual(2)
    })
  })
})
