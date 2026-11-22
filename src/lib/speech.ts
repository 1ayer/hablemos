// Thin wrappers over the Web Speech API (spec §5). Everything here degrades to "not available".

export type Voice = { voice: SpeechSynthesisVoice; exact: boolean } | null

/** Prefers a Spain voice; falls back to any Spanish voice. Voices load asynchronously in Chrome. */
export async function pickVoice(): Promise<Voice> {
  if (!('speechSynthesis' in window)) return null
  let voices = speechSynthesis.getVoices()
  if (!voices.length) {
    await new Promise<void>((done) => {
      speechSynthesis.addEventListener('voiceschanged', () => done(), { once: true })
      setTimeout(done, 2000)
    })
    voices = speechSynthesis.getVoices()
  }
  const lang = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase()
  const spain = voices.find((v) => lang(v) === 'es-es')
  if (spain) return { voice: spain, exact: true }
  const other = voices.find((v) => lang(v).startsWith('es'))
  return other ? { voice: other, exact: false } : null
}

export function say(text: string, v: NonNullable<Voice>, rate = 1) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.voice = v.voice
  u.lang = v.voice.lang
  u.rate = rate
  speechSynthesis.speak(u)
}

type Recognition = {
  lang: string
  maxAlternatives: number
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

const Ctor = (window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor })
const Recognizer = Ctor.SpeechRecognition ?? Ctor.webkitSpeechRecognition

export const canRecognize = () => !!Recognizer && navigator.onLine

export type Heard = { alternatives: string[] } | { error: string }

/** One utterance in es-ES; resolves with up to 3 alternatives or an error code such as 'not-allowed'. */
export function listen(): { result: Promise<Heard>; stop: () => void } {
  const rec = new Recognizer!()
  rec.lang = 'es-ES'
  rec.maxAlternatives = 3
  rec.interimResults = false
  const result = new Promise<Heard>((resolve) => {
    rec.onresult = (e) => resolve({ alternatives: Array.from(e.results[0], (a) => a.transcript) })
    rec.onerror = (e) => resolve({ error: e.error })
    rec.onend = () => resolve({ error: 'no-speech' }) // ignored if a result already resolved
  })
  try {
    rec.start()
  } catch {
    return { result: Promise.resolve({ error: 'start-failed' }), stop: () => {} }
  }
  return { result, stop: () => rec.abort() }
}
