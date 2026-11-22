import type { Item } from '../content'

// Storage layout and recovery rules: spec §10.
export const STATE_KEY = 'hablemos-state'
export const BACKUP_KEY = 'hablemos-backup'

export type Card = { reps: number; ease: number; interval: number; due: string }
export type Streak = { count: number; lastDate: string | null }

export type State = {
  version: 2
  xp: number
  streak: Streak
  completedLessons: string[]
  cards: Record<string, Card>
  aiItems: (Item & { sourceLessonId: string })[]
  settings: { geminiModel: string; audio: boolean }
}

export const initialState = (): State => ({
  version: 2,
  xp: 0,
  streak: { count: 0, lastDate: null },
  completedLessons: [],
  cards: {},
  aiItems: [],
  settings: { geminiModel: '', audio: true },
})

type KV = Pick<Storage, 'getItem' | 'setItem'>

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isInt = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number =>
  Number.isInteger(x) && (x as number) >= min && (x as number) <= max
const isStr = (x: unknown): x is string => typeof x === 'string'
const isDate = (x: unknown): x is string => isStr(x) && /^\d{4}-\d{2}-\d{2}$/.test(x)
const isStrs = (x: unknown): x is string[] => Array.isArray(x) && x.every(isStr)

function isCard(c: unknown): c is Card {
  return isObj(c) && isInt(c.reps) && typeof c.ease === 'number' && c.ease >= 1.3 && c.ease <= 2.5 && isInt(c.interval) && isDate(c.due)
}

function isAiItem(i: unknown): boolean {
  return (
    isObj(i) && isStr(i.id) && isStr(i.es) && isStr(i.ko) && isStr(i.sourceLessonId) &&
    (i.accept_es === undefined || isStrs(i.accept_es)) && (i.types === undefined || isStrs(i.types)) &&
    (i.note === undefined || isStr(i.note))
  )
}

/** Older saved versions, converted step by step to the current one. */
function upgrade(x: unknown): unknown {
  if (isObj(x) && x.version === 1) {
    const { hearts: _dropped, ...rest } = x // v2 removed hearts
    return { ...rest, version: 2 }
  }
  return x
}

/** The one validator for both loading and (later) importing. Returns null if anything is off. */
export function validate(input: unknown): State | null {
  const x = upgrade(input)
  if (!isObj(x) || x.version !== 2 || !isInt(x.xp)) return null
  const { streak: s, settings: st, cards } = x
  if (!isObj(s) || !isInt(s.count) || !(s.lastDate === null || isDate(s.lastDate))) return null
  if (!isStrs(x.completedLessons)) return null
  if (!isObj(cards) || !Object.values(cards).every(isCard)) return null
  if (!Array.isArray(x.aiItems) || !x.aiItems.every(isAiItem)) return null
  if (!isObj(st) || !isStr(st.geminiModel) || typeof st.audio !== 'boolean') return null
  return x as State
}

/** Reads saved state. Anything unreadable is copied to the backup key and replaced by a fresh start. */
export function load(storage: KV): { state: State; recovered: boolean } {
  const raw = storage.getItem(STATE_KEY)
  if (raw === null) return { state: initialState(), recovered: false }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = undefined
  }
  const state = validate(parsed)
  if (state) return { state, recovered: false }
  try {
    storage.setItem(BACKUP_KEY, raw)
  } catch {
    // shortcut: if even the backup write fails (storage full), the next save replaces the unreadable data.
  }
  return { state: initialState(), recovered: true }
}

/** Returns false when the browser refuses the write (quota, private mode). */
export function save(storage: KV, state: State): boolean {
  try {
    storage.setItem(STATE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
