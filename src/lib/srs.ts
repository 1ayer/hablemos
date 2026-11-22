import type { Card } from './state'

// Simplified SM-2: spec §7. Dates are local YYYY-MM-DD strings.

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10) // UTC midnight of a pure date, so no time-zone shift
}

const round2 = (x: number) => Math.round(x * 100) / 100

export const newCard = (today: string): Card => ({ reps: 0, ease: 2.5, interval: 0, due: addDays(today, 1) })

export function reviewCard(c: Card, correct: boolean, today: string): Card {
  if (!correct) return { reps: 0, interval: 1, ease: round2(Math.max(1.3, c.ease - 0.2)), due: addDays(today, 1) }
  const reps = c.reps + 1
  const interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(c.interval * c.ease)
  return { reps, interval, ease: round2(Math.min(2.5, c.ease + 0.1)), due: addDays(today, interval) }
}

/** Completing a lesson adds cards only for items that have none; existing schedules stay. */
export function registerItems(cards: Record<string, Card>, ids: string[], today: string): Record<string, Card> {
  const out = { ...cards }
  for (const id of ids) out[id] ??= newCard(today)
  return out
}

/** A first-try miss in a lesson applies the wrong-answer rule, creating the card if needed. */
export function missItem(cards: Record<string, Card>, id: string, today: string): Record<string, Card> {
  return { ...cards, [id]: reviewCard(cards[id] ?? newCard(today), false, today) }
}

const byDue = (cards: Record<string, Card>) => (a: string, b: string) =>
  cards[a].due.localeCompare(cards[b].due) || a.localeCompare(b)

/** Due cards (due ≤ today), most overdue first. `known` filters out items no longer in the content. */
export function dueIds(cards: Record<string, Card>, today: string, known: (id: string) => boolean, limit = 15): string[] {
  return Object.keys(cards).filter((id) => known(id) && cards[id].due <= today).sort(byDue(cards)).slice(0, limit)
}

/** For "practice ahead" when nothing is due: the cards coming up soonest. */
export function upcomingIds(cards: Record<string, Card>, known: (id: string) => boolean, limit = 10): string[] {
  return Object.keys(cards).filter(known).sort(byDue(cards)).slice(0, limit)
}
