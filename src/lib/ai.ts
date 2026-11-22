import { lessons, type ExerciseType, type Item } from '../content'
import { normalize, tokens } from './grade'

// Prompts and response checks for the Gemini features (spec §9). Model output is untrusted:
// everything is re-validated here and only plain strings reach the UI.

export type AiItem = Item & { sourceLessonId: string }

// Speaking is left out: generated sentences are not checked for pronounceability.
const AI_TYPES: ExerciseType[] = ['choice_es_ko', 'choice_ko_es', 'listen_choice', 'assemble', 'translate', 'dictation']

const KOREAN_RULES = `Korean translation rules:
- Informal Korean (반말) maps to "tú"; polite Korean (존댓말, -요/-습니다) maps to "usted".
- Plural "you" is marked in Korean with "(너희)" for vosotros or "(여러분, 존댓말)" for ustedes.
- When gender changes the Spanish, add "(남성)" or "(여성)" to the Korean.`

/** Words from completed lessons up to and including `lessonId`, lowercased and unique. */
export function vocabulary(lessonId: string, completed: string[]): string[] {
  const upTo = lessons.slice(0, lessons.findIndex((l) => l.id === lessonId) + 1)
  const words = upTo.filter((l) => completed.includes(l.id)).flatMap((l) => l.items.flatMap((i) => tokens(i.es)))
  return [...new Set(words.map((w) => w.toLowerCase()))]
}

export function practiceSystem(vocab: string[]): string {
  return `You write practice sentences for a Korean speaker learning Spanish as spoken in Spain, level A1.
Write 8 new, short sentences (at most 12 words) that use only these words, plus at most one common article or preposition per sentence:
${vocab.join(', ')}
Use Spain usage (vosotros, Spanish vocabulary). Each sentence must be natural and grammatical.
${KOREAN_RULES}
Answer with JSON only, in this exact shape:
{"items":[{"es":"Spanish sentence","ko":"Korean meaning","accept_es":["other correct Spanish forms, optional"]}]}`
}

const str = (x: unknown, max: number): x is string => typeof x === 'string' && x.trim() !== '' && x.length <= max

/** Keeps only well-formed, new items; the app assigns ids, types and the source lesson. */
export function parsePracticeItems(
  raw: unknown,
  sourceLessonId: string,
  existingEs: Set<string>,
  newId: () => string = () => `ai-${crypto.randomUUID()}`,
): AiItem[] {
  const list = (raw as { items?: unknown })?.items
  if (!Array.isArray(list)) return []
  const seen = new Set(existingEs)
  const out: AiItem[] = []
  for (const x of list) {
    const { es, ko, accept_es } = (x ?? {}) as Record<string, unknown>
    if (!str(es, 100) || tokens(es).length > 12 || !str(ko, 60)) continue
    const accept = Array.isArray(accept_es) ? accept_es.filter((a): a is string => str(a, 100)).slice(0, 5) : []
    const key = normalize(es)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id: newId(), es: es.trim(), ko: ko.trim(), ...(accept.length ? { accept_es: accept } : {}), types: AI_TYPES, sourceLessonId })
  }
  return out
}

export type Scenario = { id: string; title: string; role: string; opening: { es: string; ko: string } }

export const SCENARIOS: Scenario[] = [
  {
    id: 'intro',
    title: '자기소개',
    role: 'You are Lucía, a friendly student from Madrid meeting the learner for the first time. Ask their name, where they are from, and what they do.',
    opening: { es: '¡Hola! Me llamo Lucía. ¿Cómo te llamas?', ko: '안녕! 나는 루시아야. 너 이름이 뭐야?' },
  },
  {
    id: 'cafe',
    title: '카페 주문',
    role: 'You are a waiter in a small café-bar in Spain. Take the learner\'s order of drinks and tapas, and tell them the price when they ask.',
    opening: { es: '¡Buenos días! ¿Qué le pongo?', ko: '안녕하세요! 무엇을 드릴까요?' },
  },
  {
    id: 'family',
    title: '가족 소개',
    role: 'You are Javier, a friendly neighbour from Sevilla. Talk about families: ask about siblings and parents and share a little about yours.',
    opening: { es: '¡Hola! ¿Tienes hermanos?', ko: '안녕! 너 형제 있어?' },
  },
]

export function chatSystem(s: Scenario): string {
  return `You are a conversation partner for a Korean speaker learning Spanish as spoken in Spain, level A1.
${s.role}
Stay in this role. Reply in one or two short Spanish sentences (at most 12 words each), using Spain usage.
If the learner's last message has a Spanish mistake, add a short correction; otherwise correction is null.
If the learner writes in Korean, answer in simple Spanish and invite them to try in Spanish.
Answer with JSON only, in this exact shape:
{"reply_es":"your reply","reply_ko":"Korean translation of your reply","correction":null}
or with "correction":{"original":"learner's words","fixed":"corrected Spanish","explanation_ko":"one short sentence in Korean"}`
}

export type ChatReply = {
  reply_es: string
  reply_ko: string
  correction: { original: string; fixed: string; explanation_ko: string } | null
}

export function parseChatReply(raw: unknown): ChatReply | null {
  const r = (raw ?? {}) as Record<string, unknown>
  if (!str(r.reply_es, 300) || !str(r.reply_ko, 300)) return null
  const c = r.correction as Record<string, unknown> | null | undefined
  const correction = c && str(c.original, 300) && str(c.fixed, 300) && str(c.explanation_ko, 300)
    ? { original: c.original, fixed: c.fixed, explanation_ko: c.explanation_ko }
    : null
  return { reply_es: r.reply_es.trim(), reply_ko: r.reply_ko.trim(), correction }
}
