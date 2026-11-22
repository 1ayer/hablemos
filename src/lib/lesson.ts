import { itemTypes, type ExerciseType, type Item } from '../content'
import { normalize, tokens } from './grade'

export type Rand = () => number

export type Exercise = {
  type: ExerciseType
  item: Item
  /** Choice types: shuffled options including the item itself. */
  options?: Item[]
  /** assemble: shuffled word tiles including 2–3 distractor words. */
  tiles?: string[]
  /** True for the single end-of-lesson repeat of a first-try miss. */
  retry: boolean
}

const CHOICE: ExerciseType[] = ['choice_es_ko', 'choice_ko_es', 'listen_choice']
// Recognition first, then assembly, then production (spec §6).
const ORDER: Record<ExerciseType, number> = {
  choice_es_ko: 0, choice_ko_es: 0, listen_choice: 0, assemble: 1, translate: 2, dictation: 2, speak: 2,
}

export function shuffle<T>(xs: readonly T[], rand: Rand): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const answersOf = (item: Item) => [item.es, ...(item.accept_es ?? [])]

/** Wrong options from learned items, excluding synonyms of the answer (spec §5). */
export function distractors(item: Item, pool: Item[], n: number, rand: Rand): Item[] {
  const mine = new Set(answersOf(item).map(normalize))
  const picked: Item[] = []
  for (const p of shuffle(pool, rand)) {
    if (picked.length === n) break
    if (p.id === item.id || p.ko === item.ko) continue
    if (answersOf(p).some((a) => mine.has(normalize(a)))) continue
    if (picked.some((q) => q.ko === p.ko || normalize(q.es) === normalize(p.es))) continue
    picked.push(p)
  }
  return picked
}

// A capital on the sentence's first tile would reveal the first word.
// shortcut: also lowercases a sentence-initial proper noun; add a flag if content starts with one.
const tileWords = (es: string) => tokens(es).map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w))

function tilesFor(item: Item, pool: Item[], rand: Rand): string[] {
  const words = tileWords(item.es)
  const seen = new Set(words.map(normalize))
  const extra: string[] = []
  for (const w of shuffle(pool.filter((p) => p.id !== item.id).flatMap((p) => tileWords(p.es)), rand)) {
    if (extra.length === 3) break
    if (seen.has(normalize(w))) continue
    seen.add(normalize(w))
    extra.push(w)
  }
  return shuffle([...words, ...extra], rand)
}

/**
 * One exercise per item, type picked at random from what the item supports and
 * the device can run now, sorted recognition → assemble → production.
 */
export function buildLesson(items: Item[], pool: Item[], available: ExerciseType[], rand: Rand = Math.random): Exercise[] {
  const exercises = shuffle(items, rand).map((item): Exercise => {
    const wrong = distractors(item, pool, 3, rand)
    let types = itemTypes(item).filter((t) => available.includes(t))
    if (wrong.length < 2) types = types.filter((t) => !CHOICE.includes(t))
    const type = types.length ? types[Math.floor(rand() * types.length)] : 'translate'
    if (CHOICE.includes(type)) return { type, item, options: shuffle([item, ...wrong], rand), retry: false }
    if (type === 'assemble') return { type, item, tiles: tilesFor(item, pool, rand), retry: false }
    return { type, item, retry: false }
  })
  return exercises.sort((a, b) => ORDER[a.type] - ORDER[b.type])
}

export type Session = {
  queue: Exercise[]
  pos: number
  /** First-try answers graded (retries and skips excluded). */
  graded: number
  firstWrong: number
}

export const startSession = (queue: Exercise[]): Session => ({ queue, pos: 0, graded: 0, firstWrong: 0 })
export const currentExercise = (s: Session): Exercise | undefined => s.queue[s.pos]
export const isDone = (s: Session) => s.pos >= s.queue.length

/**
 * A first-try miss is repeated once at the end (lessons only; reviews pass requeue=false).
 * A missed retry is not repeated again.
 */
export function answer(s: Session, correct: boolean, requeue = true): Session {
  const ex = s.queue[s.pos]
  if (ex.retry) return { ...s, pos: s.pos + 1 }
  return {
    queue: correct || !requeue ? s.queue : [...s.queue, { ...ex, retry: true }],
    pos: s.pos + 1,
    graded: s.graded + 1,
    firstWrong: s.firstWrong + (correct ? 0 : 1),
  }
}
