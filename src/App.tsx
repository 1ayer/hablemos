import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import Chat from './Chat'
import { lessons, units, type ExerciseType, type Item, type Lesson } from './content'
import LessonView from './LessonView'
import Settings from './Settings'
import { SCENARIOS, parsePracticeItems, practiceSystem, vocabulary, type AiItem, type Scenario } from './lib/ai'
import { lessonStates, lessonXp, localDate, shownStreak, touchStreak } from './lib/game'
import { DEFAULT_MODEL, FAILURE_TEXT, KEY_STORAGE, generateJson, type GeminiFailure } from './lib/gemini'
import { normalize } from './lib/grade'
import type { Session } from './lib/lesson'
import { canRecognize, pickVoice, type Voice } from './lib/speech'
import { dueIds, missItem, registerItems, reviewCard, upcomingIds } from './lib/srs'
import { STATE_KEY, initialState, load, save, validate, type State } from './lib/state'

type Kind = 'lesson' | 'review' | 'practice' | 'ai'
type Screen =
  | { name: 'home' }
  | { name: 'study'; kind: Kind; items: Item[]; lesson?: Lesson; source?: Lesson }
  | { name: 'result'; kind: Kind; title: string; session: Session; xp: number; streak: number; aiItems?: AiItem[]; saved?: boolean }
  | { name: 'settings' }
  | { name: 'chat'; scenario: Scenario }
  | { name: 'ai'; lesson: Lesson; error?: GeminiFailure | 'few' }

const curriculum = lessons.flatMap((l) => l.items)

// localStorage can throw when site data is blocked; then every save reports failure.
function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    window.localStorage.getItem(STATE_KEY)
    return window.localStorage
  } catch {
    const fail = () => { throw new Error('storage unavailable') }
    return { getItem: () => null, setItem: fail, removeItem: fail }
  }
}

const BASE_TYPES: ExerciseType[] = ['choice_es_ko', 'choice_ko_es', 'assemble', 'translate']

const DONE_TITLE: Record<Kind, string> = {
  lesson: '레슨을 마쳤습니다',
  review: '복습을 마쳤습니다',
  practice: '연습을 마쳤습니다',
  ai: 'AI 연습을 마쳤습니다',
}

export default function App() {
  const [boot] = useState(() => load(storage()))
  const [state, setState] = useState<State>(boot.state)
  const [recovered, setRecovered] = useState(boot.recovered)
  const [saveFailed, setSaveFailed] = useState(false)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [voice, setVoice] = useState<Voice | undefined>(undefined) // undefined while voices load
  const [micBlocked, setMicBlocked] = useState(false)
  const [apiKey, setApiKey] = useState(() => storage().getItem(KEY_STORAGE) ?? '')
  const [online, setOnline] = useState(navigator.onLine)
  const [offlineReady, setOfflineReady] = useState(false)
  const aiRequest = useRef(0)

  useEffect(() => {
    pickVoice().then(setVoice)
    // Fires once, when the service worker has cached the app for the first time.
    registerSW({ onOfflineReady: () => setOfflineReady(true) })
  }, [])

  useEffect(() => setSaveFailed(!save(storage(), state)), [state])

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {})
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATE_KEY) setState(load(storage()).state)
      if (e.key === KEY_STORAGE) setApiKey(e.newValue ?? '')
    }
    const onLine = () => setOnline(navigator.onLine)
    window.addEventListener('storage', onStorage)
    window.addEventListener('online', onLine)
    window.addEventListener('offline', onLine)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('online', onLine)
      window.removeEventListener('offline', onLine)
    }
  }, [])

  const today = localDate(new Date())
  const audioOn = state.settings.audio
  const model = state.settings.geminiModel || DEFAULT_MODEL
  const aiReady = !!apiKey && online
  const itemById = new Map<string, Item>([...curriculum, ...state.aiItems].map((i) => [i.id, i]))
  const known = (id: string) => itemById.has(id)
  // Checked when a session starts, so going offline mid-session only affects the next one.
  const available: ExerciseType[] = [
    ...BASE_TYPES,
    ...(audioOn && voice ? (['listen_choice', 'dictation'] as const) : []),
    ...(audioOn && canRecognize() && !micBlocked ? (['speak'] as const) : []),
  ]

  const banners = (
    <>
      {recovered && (
        <div className="banner" role="alert">
          <p>저장된 진도를 읽지 못해 처음부터 시작합니다. 읽지 못한 기록은 따로 보관했습니다.</p>
          <button type="button" onClick={() => setRecovered(false)}>닫기</button>
        </div>
      )}
      {offlineReady && (
        <div className="banner info" role="status">
          <p>이제 인터넷 연결 없이도 레슨과 복습을 할 수 있습니다.</p>
          <button type="button" onClick={() => setOfflineReady(false)}>닫기</button>
        </div>
      )}
      {saveFailed && (
        <div className="banner" role="alert">
          <p>진도를 저장하지 못했습니다. 브라우저의 사이트 데이터 설정을 확인하세요.</p>
        </div>
      )}
    </>
  )

  async function startAi(lesson: Lesson) {
    const id = ++aiRequest.current
    setScreen({ name: 'ai', lesson })
    const r = await generateJson({
      key: apiKey,
      model,
      system: practiceSystem(vocabulary(lesson.id, state.completedLessons)),
      turns: [{ role: 'user', text: 'Write the 8 sentences now.' }],
    })
    if (id !== aiRequest.current) return // the learner left or started another request
    if (!r.ok) return setScreen({ name: 'ai', lesson, error: r.error })
    const existing = new Set([...curriculum, ...state.aiItems].map((i) => normalize(i.es)))
    const items = parsePracticeItems(r.value, lesson.id, existing)
    if (items.length < 3) return setScreen({ name: 'ai', lesson, error: 'few' })
    setScreen({ name: 'study', kind: 'ai', items, source: lesson })
  }

  const goHome = () => {
    aiRequest.current++
    setScreen({ name: 'home' })
  }

  if (screen.name === 'settings') {
    return (
      <Settings
        settings={state.settings}
        apiKey={apiKey}
        aiCount={state.aiItems.length}
        onSaveKey={(k) => {
          try {
            storage().setItem(KEY_STORAGE, k)
            setApiKey(k)
            return true
          } catch {
            return false
          }
        }}
        onDeleteKey={() => {
          try {
            storage().removeItem(KEY_STORAGE)
          } catch {
            // nothing stored to remove
          }
          setApiKey('')
        }}
        onSettings={(patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))}
        onDeleteAi={() =>
          setState((s) => {
            const ids = new Set(s.aiItems.map((i) => i.id))
            return { ...s, aiItems: [], cards: Object.fromEntries(Object.entries(s.cards).filter(([id]) => !ids.has(id))) }
          })
        }
        onReset={() => setState((s) => ({ ...initialState(), settings: s.settings }))}
        onExport={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
          const a = Object.assign(document.createElement('a'), { href: url, download: `hablemos-progress-${today}.json` })
          a.click()
          URL.revokeObjectURL(url)
        }}
        onImport={(text) => {
          let parsed: unknown
          try {
            parsed = JSON.parse(text)
          } catch {
            return '파일을 읽지 못했습니다. hablemos에서 내보낸 JSON 파일인지 확인하세요.'
          }
          const next = validate(parsed)
          if (!next) return '진도 파일 형식이 맞지 않아 가져오지 않았습니다. 지금 진도는 그대로입니다.'
          setState(next)
          return null
        }}
        onBack={goHome}
      />
    )
  }

  if (screen.name === 'chat') {
    return <Chat scenario={screen.scenario} apiKey={apiKey} model={model} voice={voice ?? null} onBack={goHome} />
  }

  if (screen.name === 'ai') {
    const { lesson, error } = screen
    return (
      <main className="page result">
        <p className="result-lesson">{lesson.title}</p>
        <h1>AI 연습</h1>
        {!error && <p role="status">배운 단어로 새 문장을 만드는 중입니다.</p>}
        {error && (
          <p role="alert">{error === 'few' ? '쓸 만한 문장을 충분히 받지 못했습니다. 다시 시도하세요.' : FAILURE_TEXT[error].message}</p>
        )}
        {error && (error === 'few' || FAILURE_TEXT[error].retry) && (
          <button className="primary" onClick={() => startAi(lesson)}>다시 시도</button>
        )}
        <button className="secondary" onClick={goHome}>홈으로</button>
      </main>
    )
  }

  if (screen.name === 'study') {
    const { kind, items, lesson, source } = screen
    const learned = lessons.filter((l) => l === lesson || state.completedLessons.includes(l.id)).flatMap((l) => l.items)
    const pool = [...learned, ...items.filter((i) => !learned.includes(i))]
    return (
      <LessonView
        items={items}
        pool={pool}
        available={available}
        voice={voice ?? null}
        onMicBlocked={() => setMicBlocked(true)}
        requeue={kind === 'lesson'}
        onFirstAnswer={(id, correct) => {
          if (kind === 'lesson' && !correct) setState((s) => ({ ...s, cards: missItem(s.cards, id, today) }))
          if (kind === 'review') setState((s) => ({ ...s, cards: { ...s.cards, [id]: reviewCard(s.cards[id], correct, today) } }))
        }}
        onExit={goHome}
        onFinish={(session) => {
          if (kind === 'ai') {
            const title = `${source!.title} AI 연습`
            return setScreen({ name: 'result', kind, title, session, xp: 0, streak: 0, aiItems: items as AiItem[] })
          }
          const firstTime = !!lesson && !state.completedLessons.includes(lesson.id)
          const xp = lesson ? lessonXp(firstTime, session.firstWrong === 0) : 5
          setState((s) => ({
            ...s,
            xp: s.xp + xp,
            streak: touchStreak(s.streak, today),
            completedLessons: firstTime ? [...s.completedLessons, lesson.id] : s.completedLessons,
            cards: lesson ? registerItems(s.cards, lesson.items.map((i) => i.id), today) : s.cards,
          }))
          const title = lesson?.title ?? (kind === 'review' ? '오늘의 복습' : '미리 연습')
          setScreen({ name: 'result', kind, title, session, xp, streak: touchStreak(state.streak, today).count })
        }}
      />
    )
  }

  if (screen.name === 'result') {
    const { graded, firstWrong, } = screen.session
    const rate = graded ? Math.round(((graded - firstWrong) / graded) * 100) : 100
    const ai = screen.aiItems
    function saveAi() {
      setState((s) => {
        const have = new Set(s.aiItems.map((i) => normalize(i.es)))
        const fresh = ai!.filter((i) => !have.has(normalize(i.es)))
        return { ...s, aiItems: [...s.aiItems, ...fresh], cards: registerItems(s.cards, fresh.map((i) => i.id), today) }
      })
      if (screen.name === 'result') setScreen({ ...screen, saved: true })
    }
    return (
      <main className="page result">
        {banners}
        <p className="result-lesson">{screen.title}</p>
        <h1>{DONE_TITLE[screen.kind]}</h1>
        {!ai && <p className="result-xp">+{screen.xp} XP</p>}
        <p>
          정답률 {rate}%{firstWrong === 0 ? ', 모두 맞혔습니다.' : `, ${firstWrong}문제를 틀렸습니다.`}
        </p>
        {!ai && <p className="muted">연속 학습 {screen.streak}일째입니다.</p>}
        {ai && (
          <>
            <p className="muted">AI가 만든 문장은 XP와 연속 학습에 들어가지 않습니다. 저장하면 내일부터 복습에 나옵니다.</p>
            <button className="secondary" onClick={saveAi} disabled={screen.saved}>
              {screen.saved ? '복습에 저장했습니다' : `문장 ${ai.length}개 복습에 저장`}
            </button>
          </>
        )}
        <button className="primary" autoFocus onClick={goHome}>
          홈으로
        </button>
      </main>
    )
  }

  const states = lessonStates(lessons, state.completedLessons)
  const due = dueIds(state.cards, today, known, Infinity)
  const ahead = due.length ? [] : upcomingIds(state.cards, known)
  const study = (kind: Kind, ids: string[]) => setScreen({ name: 'study', kind, items: ids.map((id) => itemById.get(id)!) })

  return (
    <main className="page">
      {banners}
      <header className="home-top">
        <span className="brand">hablemos</span>
        <dl className="stats">
          <div><dt>연속</dt><dd>{shownStreak(state.streak, today)}일</dd></div>
          <div><dt>XP</dt><dd>{state.xp}</dd></div>
        </dl>
        <button type="button" className="link" onClick={() => setScreen({ name: 'settings' })}>
          설정
        </button>
      </header>

      {audioOn && voice === null && <p className="voice-note muted">이 기기에 스페인어 음성이 없어 듣기 문제는 내지 않습니다.</p>}
      {audioOn && voice && !voice.exact && (
        <p className="voice-note muted">스페인 음성이 없어 다른 지역의 스페인어 음성으로 읽습니다.</p>
      )}

      {due.length > 0 && (
        <section className="review-bar" aria-label="복습">
          <p>
            오늘 복습할 문장 <strong>{due.length}개</strong>
          </p>
          <button className="primary" onClick={() => study('review', due.slice(0, 15))}>복습</button>
        </section>
      )}
      {due.length === 0 && ahead.length > 0 && (
        <section className="review-bar quiet" aria-label="복습">
          <p className="muted">오늘 복습할 문장이 없습니다.</p>
          <button className="secondary" onClick={() => study('practice', ahead)}>미리 연습</button>
        </section>
      )}

      <section className="talk" aria-labelledby="talk-title">
        <h2 id="talk-title">대화 연습</h2>
        {aiReady ? (
          <div className="talk-list">
            {SCENARIOS.map((s) => (
              <button key={s.id} type="button" className="secondary" onClick={() => setScreen({ name: 'chat', scenario: s })}>
                {s.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">
            {apiKey ? '오프라인에서는 쓸 수 없습니다.' : 'Gemini API 키를 넣으면 대화 연습과 레슨별 AI 연습을 쓸 수 있습니다. '}
            {!apiKey && (
              <button type="button" className="link inline" onClick={() => setScreen({ name: 'settings' })}>
                키 넣기
              </button>
            )}
          </p>
        )}
      </section>

      {units.map((u) => (
        <section key={u.id} className="unit" aria-labelledby={`${u.id}-title`}>
          <h2 id={`${u.id}-title`}>{u.title}</h2>
          <p className="muted">{u.description}</p>
          <ol className="path">
            {u.lessons.map((l) => {
              const st = states.get(l.id)!
              const ring = (
                <span className="dot" aria-hidden="true">
                  <span className="ring">{st === 'done' ? '✓' : ''}</span>
                </span>
              )
              return (
                <li key={l.id} className={`node ${st}`}>
                  {st === 'locked' ? (
                    <div className="node-row">
                      {ring}
                      <span className="node-title">{l.title}</span>
                      <span className="node-state">잠김</span>
                    </div>
                  ) : (
                    <button onClick={() => setScreen({ name: 'study', kind: 'lesson', items: l.items, lesson: l })}>
                      {ring}
                      <span className="node-title">{l.title}</span>
                      {st === 'done' && <span className="node-state">완료</span>}
                      {st === 'next' && <span className="start">{state.completedLessons.length ? '이어서 시작' : '시작'}</span>}
                    </button>
                  )}
                  {st === 'done' && aiReady && (
                    <button type="button" className="ai-btn" aria-label={`${l.title} AI 연습`} onClick={() => startAi(l)}>
                      AI 연습
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </main>
  )
}
