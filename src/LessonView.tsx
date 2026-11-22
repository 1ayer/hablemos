import { useEffect, useRef, useState } from 'react'
import type { ExerciseType, Item, Lesson } from './content'
import { gradeTyped, type Grade } from './lib/grade'
import { answer, answersOf, buildLesson, currentExercise, isDone, startSession, type Exercise, type Session } from './lib/lesson'

// Types the app can run in M1; audio types arrive in M4.
const AVAILABLE: ExerciseType[] = ['choice_es_ko', 'choice_ko_es', 'assemble', 'translate']
const SPECIAL = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡']

const PROMPT: Partial<Record<ExerciseType, string>> = {
  choice_es_ko: '뜻을 고르세요',
  choice_ko_es: '스페인어로 알맞은 것을 고르세요',
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

  const ex = currentExercise(session)!
  const ready = ex.options ? picked !== null : ex.tiles ? built.length > 0 : text.trim() !== ''

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

  const primary = () => (result ? next() : ready && check())

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault()
        primary()
      } else if (ex.options && !result && /^[1-9]$/.test(e.key) && e.target !== inputRef.current) {
        const o = ex.options[Number(e.key) - 1]
        if (o) setPicked(o.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => inputRef.current?.focus(), [session.pos])

  function insert(ch: string) {
    const el = inputRef.current!
    el.setRangeText(ch, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end')
    setText(el.value)
  }

  const progress = session.pos / session.queue.length

  return (
    <main className="page lesson">
      <header className="lesson-top">
        <button
          className="ghost"
          aria-label="레슨 나가기"
          onClick={() => confirm('레슨을 그만둘까요? 진행한 내용은 저장되지 않습니다.') && onExit()}
        >
          ✕
        </button>
        <div className="progress" role="progressbar" aria-label="진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      <p className="prompt-label">{ex.retry ? '다시 풀어 보세요 · ' : ''}{PROMPT[ex.type]}</p>
      <p className="prompt" lang={ex.type === 'choice_es_ko' ? 'es' : 'ko'}>
        {ex.type === 'choice_es_ko' ? ex.item.es : ex.item.ko}
      </p>

      {ex.options && (
        <div className="options">
          {ex.options.map((o, i) => (
            <button
              key={o.id}
              className={optionClass(ex, o, picked, result)}
              aria-pressed={picked === o.id}
              disabled={!!result}
              onClick={() => setPicked(o.id)}
              lang={ex.type === 'choice_es_ko' ? 'ko' : 'es'}
            >
              <span className="key">{i + 1}</span>
              {ex.type === 'choice_es_ko' ? o.ko : o.es}
            </button>
          ))}
        </div>
      )}

      {ex.tiles && (
        <>
          <div className="built" lang="es" aria-label="만든 문장">
            {built.map((t, n) => (
              <button key={t} className="tile" disabled={!!result} onClick={() => setBuilt(built.filter((_, k) => k !== n))}>
                {ex.tiles![t]}
              </button>
            ))}
          </div>
          <div className="bank" lang="es" aria-label="단어 카드">
            {ex.tiles.map((w, i) => (
              <button key={i} className="tile" disabled={!!result || built.includes(i)} onClick={() => setBuilt([...built, i])}>
                {w}
              </button>
            ))}
          </div>
        </>
      )}

      {!ex.options && !ex.tiles && (
        <>
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
        </>
      )}

      <footer className={`feedback ${result ? (result.correct ? 'ok' : 'bad') : ''}`}>
        <div role="status" aria-live="polite">
          {result && (
            <>
              <p className="verdict">{result.correct ? '정답입니다' : '오답입니다'}</p>
              {result.accentHint && <p>악센트 확인: <span lang="es">{result.accentHint}</span></p>}
              {!result.correct && (
                <p>
                  정답: <span lang="es">{ex.item.es}</span> — {ex.item.ko}
                </p>
              )}
              {ex.item.note && <p className="note">{ex.item.note}</p>}
            </>
          )}
        </div>
        <button className="primary" disabled={!result && !ready} onClick={primary}>
          {result ? '계속' : '확인'}
        </button>
      </footer>
    </main>
  )
}

function optionClass(ex: Exercise, o: Item, picked: string | null, result: Grade | null) {
  if (!result) return picked === o.id ? 'option selected' : 'option'
  if (o.id === ex.item.id) return 'option right'
  return picked === o.id ? 'option wrong' : 'option'
}
