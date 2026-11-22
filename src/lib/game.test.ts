import { describe, expect, it } from 'vitest'
import { lessons } from '../content'
import { daysBetween, lessonStates, lessonXp, localDate, shownStreak, touchStreak } from './game'

describe('dates', () => {
  it('formats the local calendar date', () => {
    expect(localDate(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05')
    expect(localDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })
  it('counts calendar days across months, years and DST changes', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-03-09', '2026-03-07')).toBe(-2)
  })
})

describe('streak', () => {
  it('starts, continues, holds and resets', () => {
    const s1 = touchStreak({ count: 0, lastDate: null }, '2026-11-20')
    expect(s1).toEqual({ count: 1, lastDate: '2026-11-20' })
    expect(touchStreak(s1, '2026-11-20')).toEqual(s1)
    expect(touchStreak(s1, '2026-11-21')).toEqual({ count: 2, lastDate: '2026-11-21' })
    expect(touchStreak({ count: 7, lastDate: '2026-11-20' }, '2026-11-23')).toEqual({ count: 1, lastDate: '2026-11-23' })
  })
  it('ignores a clock that went back', () => {
    const s = { count: 4, lastDate: '2026-11-22' }
    expect(touchStreak(s, '2026-11-21')).toEqual(s)
  })
  it('shows 0 once a day has been missed', () => {
    const s = { count: 4, lastDate: '2026-11-20' }
    expect(shownStreak(s, '2026-11-21')).toBe(4)
    expect(shownStreak(s, '2026-11-22')).toBe(0)
  })
})

describe('xp and unlocking', () => {
  it('gives 10, +5 for a perfect first run, and 5 for replays', () => {
    expect([lessonXp(true, false), lessonXp(true, true), lessonXp(false, true)]).toEqual([10, 15, 5])
  })
  it('opens lessons strictly in order across units', () => {
    const ids = lessons.map((l) => l.id)
    const s0 = lessonStates(lessons, [])
    expect(s0.get(ids[0])).toBe('next')
    expect(ids.slice(1).every((id) => s0.get(id) === 'locked')).toBe(true)
    const s3 = lessonStates(lessons, ids.slice(0, 3)) // whole first unit done
    expect(s3.get(ids[2])).toBe('done')
    expect(s3.get(ids[3])).toBe('next') // first lesson of unit 2
    expect(s3.get(ids[4])).toBe('locked')
  })
})
