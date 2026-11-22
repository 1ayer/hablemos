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
