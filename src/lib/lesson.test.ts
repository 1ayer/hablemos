import { describe, expect, it } from 'vitest'
import type { ExerciseType, Item } from '../content'
import { answer, buildLesson, currentExercise, distractors, isDone, startSession } from './lesson'

// Deterministic pseudo-random sequence for reproducible tests.
function seeded(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

const it_ = (id: string, es: string, ko: string, accept_es?: string[]): Item => ({ id, es, ko, accept_es })
const pool = [
  it_('a', '¿Qué tal?', '잘 지내?', ['¿Cómo estás?']),
  it_('b', '¿Cómo estás?', '어떻게 지내?'),
  it_('c', 'Muy bien', '아주 좋아'),
  it_('d', 'Hola', '안녕'),
  it_('e', 'Gracias', '고마워'),
  it_('f', 'De nada', '천만에'),
]
const M1: ExerciseType[] = ['choice_es_ko', 'choice_ko_es', 'assemble', 'translate']

describe('distractors', () => {
  it('excludes the item, synonyms and duplicates', () => {
    for (let s = 1; s < 30; s++) {
      const ids = distractors(pool[0], pool, 3, seeded(s)).map((d) => d.id)
      expect(ids).toHaveLength(3)
      expect(ids).not.toContain('a')
      expect(ids).not.toContain('b') // b's answer is an accepted answer of a
    }
  })
})

describe('buildLesson', () => {
  it('makes one exercise per item, ordered recognition → assemble → production', () => {
    const rank = { choice_es_ko: 0, choice_ko_es: 0, assemble: 1, translate: 2 } as Record<string, number>
    for (let s = 1; s < 30; s++) {
      const ex = buildLesson(pool, pool, M1, seeded(s))
      expect(ex.map((e) => e.item.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
      const ranks = ex.map((e) => rank[e.type])
      expect(ranks).toEqual([...ranks].sort())
      for (const e of ex) {
        if (e.type.startsWith('choice')) expect(e.options!.filter((o) => o.id === e.item.id)).toHaveLength(1)
        if (e.type === 'assemble') expect(e.item.es.split(' ').length).toBeGreaterThanOrEqual(2)
      }
    }
  })
  it('gives no capital-letter hint on assemble tiles', () => {
    const ex = buildLesson([pool[2]], pool, ['assemble'], seeded(2))[0]
    expect(ex.tiles).toContain('muy')
    expect(ex.tiles!.filter((t) => /^[A-ZÁÉÍÓÚ¿¡]/.test(t))).toEqual([])
  })
  it('never uses assemble for single-word items', () => {
    for (let s = 1; s < 50; s++) {
      const ex = buildLesson([pool[3]], pool, M1, seeded(s))
      expect(ex[0].type).not.toBe('assemble')
    }
  })
  it('drops choice types when fewer than two distractors exist', () => {
    const ex = buildLesson([pool[3]], [pool[3], pool[4]], ['choice_es_ko', 'translate'], seeded(3))
    expect(ex[0].type).toBe('translate')
  })
})

describe('session', () => {
  it('repeats a first-try miss once at the end and counts it once', () => {
    let s = startSession(buildLesson(pool.slice(2, 4), pool, ['translate'], seeded(1)))
    const first = currentExercise(s)!.item.id
    s = answer(s, false)
    s = answer(s, true)
    expect(isDone(s)).toBe(false)
    expect(currentExercise(s)).toMatchObject({ retry: true, item: { id: first } })
    s = answer(s, false) // missed retry is not repeated again
    expect(isDone(s)).toBe(true)
    expect(s).toMatchObject({ graded: 2, firstWrong: 1 })
  })
})
