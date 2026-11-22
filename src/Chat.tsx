import { useEffect, useRef, useState, type FormEvent } from 'react'
import { chatSystem, parseChatReply, type ChatReply, type Scenario } from './lib/ai'
import { FAILURE_TEXT, generateJson, type GeminiFailure, type Turn } from './lib/gemini'
import { canRecognize, listen, say, type Voice } from './lib/speech'

const SPECIAL = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡']
const SENT_TURNS = 12 // spec §9: only recent turns are sent
const MAX_TURNS = 30

type Msg = { role: 'user' | 'model'; es: string; ko?: string; correction?: ChatReply['correction'] }

type Props = { scenario: Scenario; apiKey: string; model: string; voice: Voice; onBack: () => void }

export default function Chat({ scenario, apiKey, model, voice, onBack }: Props) {
  const opening: Msg = { role: 'model', es: scenario.opening.es, ko: scenario.opening.ko }
  const [msgs, setMsgs] = useState<Msg[]>([opening])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<GeminiFailure | null>(null)
  const [listening, setListening] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true // StrictMode remounts once in development
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' }) // returns a Promise in newer browsers; must not be the effect's return
  }, [msgs, error])

  async function request(history: Msg[]) {
    setPending(true)
    setError(null)
    const turns: Turn[] = history.slice(-SENT_TURNS).map((m) => ({ role: m.role, text: m.es }))
    while (turns[0]?.role === 'model') turns.shift() // a request starts with the learner's turn
    const r = await generateJson({ key: apiKey, model, system: chatSystem(scenario), turns })
    if (!alive.current) return
    setPending(false)
    const reply = r.ok ? parseChatReply(r.value) : null
    if (!reply) return setError(r.ok ? 'format' : r.error)
    setMsgs((cur) => {
      const withFix = cur.map((m, i) => (i === cur.length - 1 && m.role === 'user' ? { ...m, correction: reply.correction } : m))
      return [...withFix, { role: 'model', es: reply.reply_es, ko: reply.reply_ko }]
    })
    if (voice) say(reply.reply_es, voice)
  }

  function send(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || pending) return
    const next = [...msgs, { role: 'user' as const, es: text }]
    setMsgs(next)
    setInput('')
    request(next)
  }

  async function speak() {
    setListening(true)
    const heard = await listen().result
    if (!alive.current) return
    setListening(false)
    if ('alternatives' in heard && heard.alternatives[0]) setInput(heard.alternatives[0])
    inputRef.current?.focus()
  }

  function insert(ch: string) {
    const el = inputRef.current!
    el.setRangeText(ch, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end')
    setInput(el.value)
  }

  const full = msgs.length >= MAX_TURNS

  return (
    <main className="page chat">
      <header className="sub-top">
        <button type="button" className="exit" aria-label="홈으로" onClick={onBack}>
          ←
        </button>
        <h1>{scenario.title}</h1>
      </header>

      <div className="messages" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <p lang="es" className="msg-es">{m.es}</p>
            {m.ko && <p className="msg-ko">{m.ko}</p>}
            {m.role === 'model' && voice && (
              <button type="button" className="link" onClick={() => say(m.es, voice)}>
                다시 듣기
              </button>
            )}
            {m.correction && (
              <div className="fix">
                <p>
                  고쳐 쓰기: <span lang="es">{m.correction.fixed}</span>
                </p>
                <p className="muted">{m.correction.explanation_ko}</p>
              </div>
            )}
          </div>
        ))}
        {pending && <p className="muted">답을 기다리는 중입니다</p>}
        {error && (
          <div className="banner" role="alert">
            <p>{FAILURE_TEXT[error].message}</p>
            {FAILURE_TEXT[error].retry && (
              <button type="button" onClick={() => request(msgs)}>
                다시 시도
              </button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {full ? (
        <div className="chat-full">
          <p className="muted">대화가 길어졌습니다. 새 대화로 이어 가세요.</p>
          <button type="button" className="primary" onClick={() => { setMsgs([opening]); setError(null) }}>
            새 대화
          </button>
        </div>
      ) : (
        <form className="composer" onSubmit={send}>
          <div className="special" aria-label="특수문자 입력">
            {SPECIAL.map((c) => (
              <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="field-row">
            <label className="sr-only" htmlFor="chat-input">스페인어로 답하기</label>
            <input id="chat-input" ref={inputRef} className="answer" lang="es" autoComplete="off" spellCheck={false} value={input} onChange={(e) => setInput(e.target.value)} />
            {canRecognize() && (
              <button type="button" className="secondary" onClick={speak} disabled={listening}>
                {listening ? '듣는 중' : '말하기'}
              </button>
            )}
            <button type="submit" className="primary" aria-disabled={pending || !input.trim()}>
              보내기
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
