const PUNCT = /[.,!?¡¿;:"'«»…‘’“”\-]/g
const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' }

export function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(PUNCT, ' ').replace(/\s+/g, ' ').trim()
}

// ñ is a separate letter (año ≠ ano), so it is deliberately not stripped.
export function stripAccents(s: string): string {
  return s.replace(/[áéíóúü]/g, (c) => ACCENTS[c])
}

export type Grade = { correct: boolean; accentHint?: string }

/** Grades a typed Spanish answer against the accepted answers (spec §5). */
export function gradeTyped(input: string, answers: string[]): Grade {
  const given = normalize(input)
  if (!given) return { correct: false }
  if (answers.some((a) => normalize(a) === given)) return { correct: true }
  const loose = stripAccents(given)
  const near = answers.find((a) => stripAccents(normalize(a)) === loose)
  return near ? { correct: true, accentHint: near } : { correct: false }
}

/** Word tiles for an answer: original spelling, punctuation removed. */
export function tokens(s: string): string[] {
  return s.split(/\s+/).map((t) => t.replace(PUNCT, '')).filter(Boolean)
}

// Recognizers often return digits; the curriculum spells numbers out (accents already stripped).
const NUMBER_WORDS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
]
const ONE = new Set(['un', 'una', 'uno'])

function speechWords(s: string): string[] {
  return stripAccents(normalize(s))
    .split(' ')
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) && Number(w) <= 20 && w !== '1' ? NUMBER_WORDS[Number(w)] : w))
}

const sameWord = (heard: string, want: string) => heard === want || (heard === '1' && ONE.has(want))

/** Word-level edit distance (insertions, deletions, substitutions each cost 1). */
export function wordDistance(heard: string[], want: string[]): number {
  let prev = want.map((_, j) => j + 1)
  prev.unshift(0)
  for (let i = 1; i <= heard.length; i++) {
    const row = [i]
    for (let j = 1; j <= want.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (sameWord(heard[i - 1], want[j - 1]) ? 0 : 1))
    }
    prev = row
  }
  return prev[want.length]
}

/** Spec §5: correct if any alternative is within floor(0.2 × target words) edits. */
export function judgeSpeech(alternatives: string[], target: string): { correct: boolean; heard: string } {
  const want = speechWords(target)
  const limit = Math.floor(0.2 * want.length)
  const hit = alternatives.find((a) => wordDistance(speechWords(a), want) <= limit)
  return { correct: hit !== undefined, heard: hit ?? alternatives[0] ?? '' }
}
