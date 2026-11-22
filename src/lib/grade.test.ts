import { describe, expect, it } from 'vitest'
import { gradeTyped, normalize, tokens } from './grade'

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
