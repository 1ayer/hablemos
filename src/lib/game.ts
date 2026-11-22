import type { Lesson } from '../content'
import type { Hearts, Streak } from './state'

// Rules: spec §6.
export const MAX_HEARTS = 5
export const REFILL_MS = 4 * 60 * 60 * 1000

/** Local calendar date as YYYY-MM-DD (never via toISOString, which is UTC). */
export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Whole calendar days from a to b; immune to DST because it compares dates, not instants. */
export function daysBetween(a: string, b: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

export function refillHearts(h: Hearts, now: number): Hearts {
  if (h.count >= MAX_HEARTS) return { count: MAX_HEARTS, refillStart: null }
  const start = h.refillStart === null || now < h.refillStart ? now : h.refillStart
  const k = Math.floor((now - start) / REFILL_MS)
  const count = Math.min(MAX_HEARTS, h.count + k)
  return { count, refillStart: count === MAX_HEARTS ? null : start + k * REFILL_MS }
}

export function loseHeart(h: Hearts, now: number): Hearts {
  const r = refillHearts(h, now)
  if (r.count === 0) return r
  return { count: r.count - 1, refillStart: r.count === MAX_HEARTS ? now : r.refillStart }
}

export function gainHeart(h: Hearts, now: number): Hearts {
  const r = refillHearts(h, now)
  const count = Math.min(MAX_HEARTS, r.count + 1)
  return { count, refillStart: count === MAX_HEARTS ? null : r.refillStart }
}

/** Milliseconds until the next heart, or null when full. */
export function nextHeartIn(h: Hearts, now: number): number | null {
  const r = refillHearts(h, now)
  return r.refillStart === null ? null : r.refillStart + REFILL_MS - now
}

/** Called when a lesson or review session is completed today. */
export function touchStreak(s: Streak, today: string): Streak {
  if (s.lastDate === null) return { count: 1, lastDate: today }
  const d = daysBetween(s.lastDate, today)
  if (d <= 0) return s // same day, or the device clock went back
  return d === 1 ? { count: s.count + 1, lastDate: today } : { count: 1, lastDate: today }
}

export function shownStreak(s: Streak, today: string): number {
  return s.lastDate !== null && daysBetween(s.lastDate, today) > 1 ? 0 : s.count
}

export function lessonXp(firstTime: boolean, perfect: boolean): number {
  return firstTime ? (perfect ? 15 : 10) : 5
}

export type LessonState = 'done' | 'next' | 'locked'

/** Lessons open strictly in order across units; completed ones stay replayable. */
export function lessonStates(lessons: Lesson[], completed: string[]): Map<string, LessonState> {
  const states = new Map<string, LessonState>()
  let nextFound = false
  for (const l of lessons) {
    if (completed.includes(l.id)) states.set(l.id, 'done')
    else if (!nextFound) {
      states.set(l.id, 'next')
      nextFound = true
    } else states.set(l.id, 'locked')
  }
  return states
}
