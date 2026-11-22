import { describe, expect, it } from 'vitest'
import { addDays, dueIds, missItem, newCard, registerItems, reviewCard, upcomingIds } from './srs'

const today = '2026-11-22'
const all = () => true

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })
})

describe('reviewCard', () => {
  it('grows the interval 1 → 3 → interval × ease on correct answers', () => {
    let c = newCard(today)
    expect(c).toEqual({ reps: 0, ease: 2.5, interval: 0, due: '2026-11-23' })
    c = reviewCard(c, true, '2026-11-23')
    expect(c).toEqual({ reps: 1, ease: 2.5, interval: 1, due: '2026-11-24' })
    c = reviewCard(c, true, '2026-11-24')
    expect(c).toEqual({ reps: 2, ease: 2.5, interval: 3, due: '2026-11-27' })
    c = reviewCard(c, true, '2026-11-27')
    expect(c).toEqual({ reps: 3, ease: 2.5, interval: 8, due: '2026-12-05' }) // round(3 × 2.5)
  })
  it('resets on a miss, lowers ease to a floor, and recovers it later', () => {
    let c = { reps: 4, ease: 1.4, interval: 20, due: today }
    c = reviewCard(c, false, today)
    expect(c).toEqual({ reps: 0, ease: 1.3, interval: 1, due: '2026-11-23' })
    expect(reviewCard(c, false, today).ease).toBe(1.3)
    expect(reviewCard(c, true, today).ease).toBe(1.4)
  })
})

describe('lesson effects', () => {
  it('registers only missing cards and keeps existing schedules', () => {
    const kept = { reps: 3, ease: 2.2, interval: 9, due: '2026-12-01' }
    const cards = registerItems({ a: kept }, ['a', 'b'], today)
    expect(cards.a).toBe(kept)
    expect(cards.b).toEqual(newCard(today))
  })
  it('a lesson miss makes the item due tomorrow, creating the card if needed', () => {
    expect(missItem({}, 'x', today).x).toMatchObject({ reps: 0, interval: 1, due: '2026-11-23' })
    expect(missItem({ x: { reps: 5, ease: 2.5, interval: 30, due: '2027-01-01' } }, 'x', today).x.due).toBe('2026-11-23')
  })
})

describe('session picking', () => {
  const cards = {
    late: { reps: 1, ease: 2.5, interval: 1, due: '2026-11-20' },
    now: { reps: 1, ease: 2.5, interval: 1, due: today },
    soon: { reps: 1, ease: 2.5, interval: 1, due: '2026-11-25' },
    gone: { reps: 1, ease: 2.5, interval: 1, due: '2026-11-01' },
  }
  const known = (id: string) => id !== 'gone'
  it('takes due cards (including today) most overdue first, skipping removed items', () => {
    expect(dueIds(cards, today, known)).toEqual(['late', 'now'])
    expect(dueIds(cards, today, all, 1)).toEqual(['gone'])
  })
  it('lists upcoming cards for practice ahead', () => {
    expect(upcomingIds(cards, known)).toEqual(['late', 'now', 'soon'])
  })
})
