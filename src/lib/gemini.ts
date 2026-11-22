// Gemini REST generateContent, called from the browser with the user's own key (spec §9).
// Free-tier defaults: checked against Google's model and pricing pages on 2026-11-22.

export const KEY_STORAGE = 'hablemos-gemini-key'
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
export const MODEL_SUGGESTIONS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']

// The model ID goes into the URL path, so only plain ID characters are allowed.
export const isModelId = (m: string) => /^[a-z0-9][a-z0-9.-]{1,63}$/.test(m)

export type Turn = { role: 'user' | 'model'; text: string }
export type GeminiFailure = 'key' | 'quota' | 'model' | 'temporary' | 'format'
export type GeminiResult = { ok: true; value: unknown } | { ok: false; error: GeminiFailure }

type Fetch = typeof fetch

/** Asks for a JSON answer. The shape is described in `system`; callers validate `value`. */
export async function generateJson(
  args: { key: string; model: string; system: string; turns: Turn[] },
  fetchFn: Fetch = fetch,
): Promise<GeminiResult> {
  const model = isModelId(args.model) ? args.model : DEFAULT_MODEL
  let res: Response
  try {
    res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': args.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: args.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        // maxOutputTokens also counts thinking tokens, so leave headroom.
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
      }),
    })
  } catch {
    return { ok: false, error: 'temporary' }
  }
  if (!res.ok) return { ok: false, error: failureFor(res.status) }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, error: 'format' }
  }
  const text = responseText(body)
  if (text === null) return { ok: false, error: 'format' }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, error: 'format' }
  }
}

export function failureFor(status: number): GeminiFailure {
  if (status === 401 || status === 403) return 'key'
  if (status === 429) return 'quota'
  if (status === 400 || status === 404) return 'model'
  return 'temporary'
}

/** Joins the first candidate's text parts (skipping thought parts); null unless it finished normally. */
export function responseText(body: unknown): string | null {
  const c = (body as { candidates?: { finishReason?: string; content?: { parts?: { text?: unknown; thought?: boolean }[] } }[] })
    ?.candidates?.[0]
  if (!c || c.finishReason !== 'STOP') return null
  const text = (c.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('')
  return text.trim() ? text : null
}

export const FAILURE_TEXT: Record<GeminiFailure, { message: string; retry: boolean }> = {
  key: { message: 'API 키가 맞지 않거나 권한이 없습니다. 설정에서 키를 확인하세요.', retry: false },
  quota: { message: '무료 사용 한도를 넘었습니다. 잠시 뒤 다시 시도하세요. 하루 한도는 미국 태평양 시간 자정에 초기화됩니다.', retry: true },
  model: { message: '모델 ID를 쓸 수 없거나 요청 형식이 맞지 않습니다. 설정에서 모델 ID를 확인하세요.', retry: false },
  temporary: { message: 'Gemini에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.', retry: true },
  format: { message: '응답 형식이 맞지 않습니다. 다시 시도하세요.', retry: true },
}
