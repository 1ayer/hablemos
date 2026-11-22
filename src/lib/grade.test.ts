import { describe, expect, it } from 'vitest'
import { gradeTyped, judgeSpeech, normalize, tokens } from './grade'

describe('normalize', () => {
  it('lowercases, drops punctuation, keeps word boundaries', () => {
    expect(normalize('  ¿Qué  tal?  ')).toBe('qué tal')
    expect(normalize('Bien,gracias')).toBe('bien gracias')
  })
  it('composes decomposed accents (NFC)', () => {
    expect(normalize('café')).toBe('café')
  })
})

describe('gradeTyped', () => {
  const answers = ['¿Cómo estás?', '¿Qué tal?']
  it('accepts any listed answer regardless of case and punctuation', () => {
    expect(gradeTyped('qué tal', answers)).toEqual({ correct: true })
    expect(gradeTyped('¿CÓMO ESTÁS?', answers)).toEqual({ correct: true })
  })
  it('accepts missing accents with a hint showing the correct form', () => {
    expect(gradeTyped('como estas', answers)).toEqual({ correct: true, accentHint: '¿Cómo estás?' })
  })
  it('treats ñ as its own letter', () => {
    expect(gradeTyped('hasta manana', ['Hasta mañana']).correct).toBe(false)
    expect(gradeTyped('hasta mañana', ['Hasta mañana']).correct).toBe(true)
  })
  it('rejects empty and wrong answers', () => {
    expect(gradeTyped('   ', answers).correct).toBe(false)
    expect(gradeTyped('muy bien', answers).correct).toBe(false)
  })
})

describe('tokens', () => {
  it('splits into tiles without punctuation, keeping spelling', () => {
    expect(tokens('¿Cómo te llamas?')).toEqual(['Cómo', 'te', 'llamas'])
    expect(tokens('Bien, gracias')).toEqual(['Bien', 'gracias'])
  })
})

describe('judgeSpeech', () => {
  it('accepts exact recognition regardless of case, punctuation and accents', () => {
    expect(judgeSpeech(['como estas'], '¿Cómo estás?')).toEqual({ correct: true, heard: 'como estas' })
  })
  it('needs every word for sentences of four words or fewer', () => {
    expect(judgeSpeech(['hasta'], 'Hasta luego').correct).toBe(false)
    expect(judgeSpeech(['una mesa para dos por favor'], 'Una mesa para dos, por favor').correct).toBe(true)
  })
  it('allows one edit per five words and counts extra words', () => {
    expect(judgeSpeech(['una mesa para dos por favor'], 'Una mesa para dos personas, por favor').correct).toBe(true) // 7 words, 1 missing
    expect(judgeSpeech(['hola una mesa para dos personas por favor ya'], 'Una mesa para dos personas, por favor').correct).toBe(false) // 2 extra
  })
  it('reads recognizer digits as the spelled-out curriculum words', () => {
    expect(judgeSpeech(['una mesa para 2 por favor'], 'Una mesa para dos, por favor').correct).toBe(true)
    expect(judgeSpeech(['1 café por favor'], 'Un café, por favor').correct).toBe(true)
  })
  it('passes if any alternative matches, and reports the first one otherwise', () => {
    expect(judgeSpeech(['oye la', 'hola'], 'Hola')).toEqual({ correct: true, heard: 'hola' })
    expect(judgeSpeech(['adiós', 'a dios'], 'Hola')).toEqual({ correct: false, heard: 'adiós' })
    expect(judgeSpeech([], 'Hola')).toEqual({ correct: false, heard: '' })
  })
})
