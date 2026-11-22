import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ExerciseType, Item } from './content'
import { gradeTyped, judgeSpeech, type Grade } from './lib/grade'
import {
  answer, answersOf, buildLesson, currentExercise, isDone, retypeRemaining, skip, startSession, type Exercise, type Session,
} from './lib/lesson'
import { listen, say, type Voice } from './lib/speech'

const SPECIAL = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡']

const PROMPT: Record<ExerciseType, string> = {
  choice_es_ko: '뜻을 고르세요',
  choice_ko_es: '알맞은 스페인어를 고르세요',
  listen_choice: '듣고 뜻을 고르세요',
  assemble: '단어를 눌러 스페인어 문장을 만드세요',
  translate: '스페인어로 쓰세요',
  dictation: '듣고 스페인어로 쓰세요',
  speak: '소리 내어 읽으세요',
}

type Result = Grade & { heard?: string }
type Mic = 'idle' | 'listening' | 'failed'

type Props = {
  items: Item[]
  /** Learned items used for wrong options and extra tiles. */
  pool: Item[]
  /** Exercise types this device can run right now. */
  available: ExerciseType[]
  voice: Voice
  /** Lessons repeat first-try misses at the end; reviews do not. */
  requeue: boolean
  /** Called once per item on its first try, when it is checked (so leaving early still counts). */
  onFirstAnswer: (itemId: string, correct: boolean) => void
  /** The browser refused the microphone; speaking stays off until reload. */
  onMicBlocked: () => void
  onExit: () => void
  onFinish: (s: Session) => void
}

export default function LessonView({ items, pool, available, voice, requeue, onFirstAnswer, onMicBlocked, onExit, onFinish }: Props) {
  const [session, setSession] = useState(() => startSession(buildLesson(items, pool, available)))
  const [picked, setPicked] = useState<string | null>(null) // choice: option item id
  const [built, setBuilt] = useState<number[]>([]) // assemble: tile indexes in order
  const [text, setText] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [mic, setMic] = useState<Mic>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const stopRef = useRef<() => void>(() => {})

  const ex = currentExercise(session)!
  const t = ex.type
  const listens = t === 'listen_choice' || t === 'dictation'
  const showsEs = t === 'choice_es_ko' || t === 'speak'
  const optionKo = t === 'choice_es_ko' || t === 'listen_choice'
  const typed = t === 'translate' || t === 'dictation'
  const ready = ex.options ? picked !== null : ex.tiles ? built.length > 0 : typed && text.trim() !== ''

  function grade(g: Result) {
    setResult(g)
    if (!ex.retry) onFirstAnswer(ex.item.id, g.correct)
  }

  function check() {
    if (ex.options) grade({ correct: picked === ex.item.id })
    else grade(gradeTyped(ex.tiles ? built.map((i) => ex.tiles![i]).join(' ') : text, answersOf(ex.item)))
  }

  function advance(s: Session) {
    stopRef.current()
    setPicked(null)
    setBuilt([])
    setText('')
    setResult(null)
    setMic('idle')
    if (isDone(s)) onFinish(s)
    else setSession(s)
  }

  const next = () => advance(answer(session, result!.correct, requeue))

  function dropSpeaking(message: string) {
    stopRef.current()
    setMic('idle')
    setNotice(message)
    setSession((s) => retypeRemaining(s, 'speak', pool, available))
  }

  async function record() {
    setMic('listening')
    const h = listen()
    stopRef.current = h.stop
    const heard = await h.result
    if ('error' in heard) {
      if (heard.error === 'not-allowed' || heard.error === 'service-not-allowed') {
        onMicBlocked()
        dropSpeaking('마이크를 쓸 수 없어 말하기 문제를 빼고 진행합니다. 브라우저의 마이크 권한을 확인하세요.')
      } else if (heard.error !== 'aborted') setMic('failed')
      return
    }
    setMic('idle')
    grade(judgeSpeech(heard.alternatives, ex.item.es))
  }

  // The form gives Enter-to-submit natively in the text field and on the options;
  // other buttons keep their own Enter behavior.
  function submit(e: FormEvent) {
    e.preventDefault()
    if (result) next()
    else if (ready) check()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.isComposing || e.repeat) return
      if (e.key === 'Enter' && e.target === document.body) {
        e.preventDefault()
        primaryRef.current?.click()
      } else if (ex.options && !result && /^[1-9]$/.test(e.key)) {
        const o = ex.options[Number(e.key) - 1]
        if (o) setPicked(o.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    inputRef.current?.focus()
    if (listens && voice) say(ex.item.es, voice)
  }, [session.pos, t]) // once per exercise, not on every render

  useEffect(() => {
    if (result) primaryRef.current?.focus()
  }, [result])

  useEffect(
    () => () => {
      stopRef.current()
      if ('speechSynthesis' in window) speechSynthesis.cancel()
    },
    [],
  )

  function insert(ch: string) {
    const el = inputRef.current!
    el.setRangeText(ch, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end')
    el.focus() // the field may have lost focus before the tap; keep typing where the letter went
    setText(el.value)
  }

  const done = session.pos
  const total = session.queue.length
  const playButtons = voice && (
    <div className="play-row">
      <button type="button" className="play" onClick={() => say(ex.item.es, voice)}>
        <span aria-hidden="true">▶</span> 듣기
      </button>
      <button type="button" className="play" onClick={() => say(ex.item.es, voice, 0.7)}>
        느리게
      </button>
    </div>
  )

  return (
    <main className="page lesson">
      <header className="lesson-top">
        <button
          type="button"
          className="exit"
          aria-label="나가기"
          onClick={() => confirm('그만둘까요? 진행한 내용은 저장되지 않습니다.') && onExit()}
        >
          ✕
        </button>
        <div className="progress" role="progressbar" aria-label="진행" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <div style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span className="count">
          {done}/{total}
        </span>
      </header>

      {notice && (
        <p className="lesson-notice" role="status">
          {notice}
        </p>
      )}

      <form className="lesson-body" onSubmit={submit}>
        <div className="question">
          {ex.retry && <p className="retry">다시 나온 문제</p>}
          <p className="prompt-label">{PROMPT[t]}</p>
          {!listens && (
            <p className="prompt" lang={showsEs ? 'es' : 'ko'}>
              {showsEs ? ex.item.es : ex.item.ko}
            </p>
          )}
          {(listens || t === 'speak') && playButtons}
        </div>

        {ex.options && (
          <fieldset className="options" disabled={!!result}>
            <legend className="sr-only">{PROMPT[t]}</legend>
            {ex.options.map((o, i) => {
              const mark = optionMark(ex, o, picked, result)
              return (
                <label key={o.id} className={`option ${mark ?? ''}`} lang={optionKo ? 'ko' : 'es'}>
                  <input type="radio" name="option" className="sr-only" checked={picked === o.id} onChange={() => setPicked(o.id)} />
                  <span className="key" aria-hidden="true">
                    {mark === 'right' ? '✓' : mark === 'wrong' ? '✕' : i + 1}
                  </span>
                  <span className="option-text">{optionKo ? o.ko : o.es}</span>
                  {mark === 'right' && <span className="mark">정답</span>}
                  {mark === 'wrong' && <span className="mark">내 답</span>}
                </label>
              )
            })}
          </fieldset>
        )}

        {ex.tiles && (
          <div className="assemble">
            <div className="built" lang="es" aria-label="만든 문장">
              {built.length === 0 && <span className="built-hint">아래 단어를 차례로 누르세요</span>}
              {built.map((ti, n) => (
                <button type="button" key={ti} className="tile" disabled={!!result} onClick={() => setBuilt(built.filter((_, k) => k !== n))}>
                  {ex.tiles![ti]}
                </button>
              ))}
            </div>
            <div className="bank" lang="es" aria-label="단어 카드">
              {ex.tiles.map((w, i) => {
                const used = built.includes(i)
                return (
                  <button type="button" key={i} className={`tile ${used ? 'used' : ''}`} aria-hidden={used} disabled={!!result || used} onClick={() => setBuilt([...built, i])}>
                    {w}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {typed && (
          <div className="typing">
            <input
              ref={inputRef}
              className="answer"
              lang="es"
              aria-label="스페인어 답"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={text}
              readOnly={!!result}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="special" aria-label="특수문자 입력">
              {SPECIAL.map((c) => (
                <button key={c} type="button" disabled={!!result} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {t === 'speak' && !result && (
          <div className="speaking">
            <button type="button" className="mic" onClick={record} disabled={mic === 'listening'} aria-live="polite">
              {mic === 'listening' ? '듣는 중입니다' : mic === 'failed' ? '다시 말하기' : '말하기'}
            </button>
            {mic === 'failed' && (
              <p className="muted" role="status">
                말소리를 알아듣지 못했습니다. 다시 말하거나 건너뛰세요.
              </p>
            )}
            <div className="speak-alt">
              {mic === 'failed' && (
                <button type="button" className="link" onClick={() => advance(skip(session))}>
                  건너뛰기
                </button>
              )}
              <button type="button" className="link" onClick={() => dropSpeaking('이번에는 말하기 문제를 빼고 진행합니다.')}>
                지금은 말할 수 없음
              </button>
            </div>
          </div>
        )}

        <footer className={`sheet ${result ? (result.correct ? 'ok' : 'bad') : ''}`}>
          <div role="status" aria-live="polite">
            {result && (
              <div className="sheet-body">
                <p className="verdict">
                  <span aria-hidden="true">{result.correct ? '✓' : '!'}</span> {result.correct ? '정답입니다' : '오답입니다'}
                </p>
                {result.accentHint && <p>악센트 표기를 확인하세요.</p>}
                {result.heard !== undefined && (
                  <p>
                    들린 문장: <span lang="es">{result.heard || '(없음)'}</span>
                  </p>
                )}
                <p className="answer-line">
                  <span lang="es">{ex.item.es}</span>
                  <br />
                  {ex.item.ko}
                </p>
                {ex.item.note && <p className="note">{ex.item.note}</p>}
              </div>
            )}
          </div>
          {(t !== 'speak' || result) && (
            <button ref={primaryRef} type="submit" className="primary" aria-disabled={!result && !ready}>
              {result ? '계속' : '확인'}
            </button>
          )}
        </footer>
      </form>
    </main>
  )
}

function optionMark(ex: Exercise, o: Item, picked: string | null, result: Grade | null) {
  if (!result) return picked === o.id ? 'selected' : null
  if (o.id === ex.item.id) return 'right'
  return picked === o.id ? 'wrong' : null
}
