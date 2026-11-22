import { describe, expect, it, vi } from 'vitest'
import { parseChatReply, parsePracticeItems, vocabulary } from './ai'
import { failureFor, generateJson, responseText } from './gemini'

describe('vocabulary', () => {
  it('collects lowercased words from completed lessons up to the chosen one', () => {
    const v = vocabulary('u1-l2', ['u1-l1', 'u1-l2', 'u1-l3'])
    expect(v).toContain('hola')
    expect(v).toContain('qué')
    expect(v).not.toContain('llamo') // u1-l3 comes after the chosen lesson
    expect(vocabulary('u1-l2', ['u1-l2'])).not.toContain('hola') // u1-l1 not completed
  })
})

describe('parsePracticeItems', () => {
  let n = 0
  const id = () => `ai-${++n}`
  it('keeps valid items and assigns id, types and source', () => {
    const out = parsePracticeItems({ items: [{ es: ' Hola, Ana ', ko: '안녕, 아나', accept_es: ['Hola Ana', ''] }] }, 'u1-l1', new Set(), id)
    expect(out).toEqual([
      { id: 'ai-1', es: 'Hola, Ana', ko: '안녕, 아나', accept_es: ['Hola Ana'], types: expect.any(Array), sourceLessonId: 'u1-l1' },
    ])
    expect(out[0].types).not.toContain('speak')
  })
  it('drops malformed, overlong and duplicate items', () => {
    const out = parsePracticeItems(
      {
        items: [
          { es: 'Buenos días', ko: '좋은 아침' }, // already in the curriculum
          { es: 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece', ko: '숫자' },
          { es: 'Muy bien', ko: '' },
          { es: 42, ko: '숫자' },
          { es: 'Tengo pan', ko: '나는 빵이 있어' },
          { es: 'tengo pan.', ko: '빵 있어' },
        ],
      },
      'u2-l2',
      new Set(['buenos días']),
      id,
    )
    expect(out.map((i) => i.es)).toEqual(['Tengo pan'])
  })
  it('returns nothing for a wrong top-level shape', () => {
    expect(parsePracticeItems([{ es: 'Hola', ko: '안녕' }], 'u1-l1', new Set(), id)).toEqual([])
    expect(parsePracticeItems(null, 'u1-l1', new Set(), id)).toEqual([])
  })
})

describe('parseChatReply', () => {
  it('accepts a reply with or without a correction', () => {
    expect(parseChatReply({ reply_es: 'Muy bien.', reply_ko: '좋아.', correction: null })).toEqual({ reply_es: 'Muy bien.', reply_ko: '좋아.', correction: null })
    const c = { original: 'yo es', fixed: 'yo soy', explanation_ko: 'yo에는 soy를 씁니다.' }
    expect(parseChatReply({ reply_es: 'Vale.', reply_ko: '알겠어.', correction: c })?.correction).toEqual(c)
  })
  it('drops a half-formed correction and rejects missing text', () => {
    expect(parseChatReply({ reply_es: 'Vale.', reply_ko: '알겠어.', correction: { original: 'x' } })?.correction).toBeNull()
    expect(parseChatReply({ reply_es: '', reply_ko: '알겠어.' })).toBeNull()
    expect(parseChatReply('Vale')).toBeNull()
  })
})

describe('gemini client', () => {
  const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))
  const reply = (text: string, finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] })
  const args = { key: 'k', model: 'gemini-3.5-flash-lite', system: 's', turns: [{ role: 'user' as const, text: 'hi' }] }

  it('sends the key in a header, not the URL, and parses JSON text', async () => {
    const f = ok(reply('{"a":1}'))
    expect(await generateJson(args, f)).toEqual({ ok: true, value: { a: 1 } })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
    expect(url).not.toContain('k')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k')
  })
  it('falls back to the default model for an unsafe model id', async () => {
    const f = ok(reply('{}'))
    await generateJson({ ...args, model: '../x?y' }, f)
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain('/models/gemini-3.5-flash-lite:')
  })
  it('maps HTTP errors, network errors and bad bodies', async () => {
    expect([401, 403, 429, 400, 404, 500, 503].map(failureFor)).toEqual(['key', 'key', 'quota', 'model', 'model', 'temporary', 'temporary'])
    expect(await generateJson(args, vi.fn(async () => { throw new TypeError('offline') }))).toEqual({ ok: false, error: 'temporary' })
    expect(await generateJson(args, ok(reply('not json')))).toEqual({ ok: false, error: 'format' })
    expect(await generateJson(args, ok(reply('{"a":1', 'MAX_TOKENS')))).toEqual({ ok: false, error: 'format' })
  })
  it('skips thought parts and empty candidates', () => {
    expect(responseText({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'x', thought: true }, { text: '{}' }] } }] })).toBe('{}')
    expect(responseText({ candidates: [] })).toBeNull()
  })
})
