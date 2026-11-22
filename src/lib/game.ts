import type { Lesson } from '../content'
import type { Streak } from './state'

// Rules: spec §6.
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
