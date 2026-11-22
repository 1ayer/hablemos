import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ExerciseType, Item, Lesson } from './content'
import { gradeTyped, type Grade } from './lib/grade'
import { answer, answersOf, buildLesson, currentExercise, isDone, startSession, type Exercise, type Session } from './lib/lesson'

// Types the app can run in M1; audio types arrive in M4.
const AVAILABLE: ExerciseType[] = ['choice_es_ko', 'choice_ko_es', 'assemble', 'translate']
const SPECIAL = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡']

const PROMPT: Partial<Record<ExerciseType, string>> = {
  choice_es_ko: '뜻을 고르세요',
  choice_ko_es: '알맞은 스페인어를 고르세요',
  assemble: '단어를 눌러 스페인어 문장을 만드세요',
  translate: '스페인어로 쓰세요',
}

type Props = { lesson: Lesson; pool: Item[]; onExit: () => void; onFinish: (s: Session) => void }

export default function LessonView({ lesson, pool, onExit, onFinish }: Props) {
  const [session, setSession] = useState(() => startSession(buildLesson(lesson.items, pool, AVAILABLE)))
  const [picked, setPicked] = useState<string | null>(null) // choice: option item id
  const [built, setBuilt] = useState<number[]>([]) // assemble: tile indexes in order
  const [text, setText] = useState('')
  const [result, setResult] = useState<Grade | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)

  const ex = currentExercise(session)!
  const ready = ex.options ? picked !== null : ex.tiles ? built.length > 0 : text.trim() !== ''
  const esPrompt = ex.type === 'choice_es_ko'

  function check() {
    if (ex.options) setResult({ correct: picked === ex.item.id })
    else if (ex.tiles) setResult(gradeTyped(built.map((i) => ex.tiles![i]).join(' '), answersOf(ex.item)))
    else setResult(gradeTyped(text, answersOf(ex.item)))
  }

  function next() {
    const s = answer(session, result!.correct)
    setPicked(null)
    setBuilt([])
    setText('')
    setResult(null)
    if (isDone(s)) onFinish(s)
    else setSession(s)
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

  useEffect(() => inputRef.current?.focus(), [session.pos])
  useEffect(() => {
    if (result) primaryRef.current?.focus()
  }, [result])

  function insert(ch: string) {
    const el = inputRef.current!
    el.setRangeText(ch, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end')
    setText(el.value)
  }

  const done = session.pos
  const total = session.queue.length

  return (
    <main className="page lesson">
      <header className="lesson-top">
        <button
          type="button"
          className="exit"
          aria-label="레슨 나가기"
          onClick={() => confirm('레슨을 그만둘까요? 진행한 내용은 저장되지 않습니다.') && onExit()}
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

      <form className="lesson-body" onSubmit={submit}>
        <div className="question">
          {ex.retry && <p className="retry">다시 나온 문제</p>}
          <p className="prompt-label">{PROMPT[ex.type]}</p>
          <p className="prompt" lang={esPrompt ? 'es' : 'ko'}>
            {esPrompt ? ex.item.es : ex.item.ko}
          </p>
        </div>

        {ex.options && (
          <fieldset className="options" disabled={!!result}>
            <legend className="sr-only">{PROMPT[ex.type]}</legend>
            {ex.options.map((o, i) => {
              const mark = optionMark(ex, o, picked, result)
              return (
                <label key={o.id} className={`option ${mark ?? ''}`} lang={esPrompt ? 'ko' : 'es'}>
                  <input type="radio" name="option" className="sr-only" checked={picked === o.id} onChange={() => setPicked(o.id)} />
                  <span className="key" aria-hidden="true">
                    {mark === 'right' ? '✓' : mark === 'wrong' ? '✕' : i + 1}
                  </span>
                  <span className="option-text">{esPrompt ? o.ko : o.es}</span>
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
              {built.map((t, n) => (
                <button type="button" key={t} className="tile" disabled={!!result} onClick={() => setBuilt(built.filter((_, k) => k !== n))}>
                  {ex.tiles![t]}
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

        {!ex.options && !ex.tiles && (
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

        <footer className={`sheet ${result ? (result.correct ? 'ok' : 'bad') : ''}`}>
          <div role="status" aria-live="polite">
            {result && (
              <div className="sheet-body">
                <p className="verdict">
                  <span aria-hidden="true">{result.correct ? '✓' : '!'}</span> {result.correct ? '정답입니다' : '오답입니다'}
                </p>
                {result.accentHint && <p>악센트 표기를 확인하세요.</p>}
                <p className="answer-line">
                  <span lang="es">{ex.item.es}</span>
                  <br />
                  {ex.item.ko}
                </p>
                {ex.item.note && <p className="note">{ex.item.note}</p>}
              </div>
            )}
          </div>
          <button ref={primaryRef} type="submit" className="primary" aria-disabled={!result && !ready}>
            {result ? '계속' : '확인'}
          </button>
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
