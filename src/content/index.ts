import { tokens } from '../lib/grade'
import data from './units.json'

export const EXERCISE_TYPES = [
  'choice_es_ko',
  'choice_ko_es',
  'listen_choice',
  'assemble',
  'translate',
  'dictation',
  'speak',
] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export type Item = {
  id: string
  es: string
  ko: string
  accept_es?: string[]
  /** Omitted means every type whose condition the item meets (spec §5). */
  types?: ExerciseType[]
  note?: string
}
export type Lesson = { id: string; title: string; items: Item[] }
export type Unit = { id: string; title: string; description: string; lessons: Lesson[] }

export const units = data as Unit[]

export function itemTypes(item: Item): ExerciseType[] {
  const all = item.types ?? [...EXERCISE_TYPES]
  return tokens(item.es).length >= 2 ? all : all.filter((t) => t !== 'assemble')
}

export const lessons: Lesson[] = units.flatMap((u) => u.lessons)
