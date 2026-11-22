import { useEffect, useState } from 'react'
import { lessons, units, type Item, type Lesson } from './content'
import LessonView from './LessonView'
import { lessonStates, lessonXp, localDate, shownStreak, touchStreak } from './lib/game'
import type { Session } from './lib/lesson'
import { dueIds, missItem, registerItems, reviewCard, upcomingIds } from './lib/srs'
import { STATE_KEY, load, save, type State } from './lib/state'

type Kind = 'lesson' | 'review' | 'practice'
type Screen =
  | { name: 'home' }
  | { name: 'study'; kind: Kind; items: Item[]; lesson?: Lesson }
  | { name: 'result'; kind: Kind; title: string; session: Session; xp: number; streak: number }

const itemById = new Map(lessons.flatMap((l) => l.items).map((i) => [i.id, i]))
const known = (id: string) => itemById.has(id)

// localStorage can throw when site data is blocked; then every save reports failure.
function storage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    window.localStorage.getItem(STATE_KEY)
    return window.localStorage
  } catch {
    return { getItem: () => null, setItem: () => { throw new Error('storage unavailable') } }
  }
}

const DONE_TITLE: Record<Kind, string> = { lesson: '레슨을 마쳤습니다', review: '복습을 마쳤습니다', practice: '연습을 마쳤습니다' }

export default function App() {
  const [boot] = useState(() => load(storage()))
  const [state, setState] = useState<State>(boot.state)
  const [recovered, setRecovered] = useState(boot.recovered)
  const [saveFailed, setSaveFailed] = useState(false)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  useEffect(() => setSaveFailed(!save(storage(), state)), [state])

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {})
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATE_KEY) setState(load(storage()).state)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const today = localDate(new Date())

  const banners = (
    <>
      {recovered && (
        <div className="banner" role="alert">
          <p>저장된 진도를 읽지 못해 처음부터 시작합니다. 읽지 못한 기록은 따로 보관했습니다.</p>
          <button type="button" onClick={() => setRecovered(false)}>닫기</button>
        </div>
      )}
      {saveFailed && (
        <div className="banner" role="alert">
          <p>진도를 저장하지 못했습니다. 브라우저의 사이트 데이터 설정을 확인하세요.</p>
        </div>
      )}
    </>
  )

  if (screen.name === 'study') {
    const { kind, items, lesson } = screen
    const learned = lessons.filter((l) => l === lesson || state.completedLessons.includes(l.id)).flatMap((l) => l.items)
    return (
      <LessonView
        items={items}
        pool={learned}
        requeue={kind === 'lesson'}
        onFirstAnswer={(id, correct) => {
          if (kind === 'lesson' && !correct) setState((s) => ({ ...s, cards: missItem(s.cards, id, today) }))
          if (kind === 'review') setState((s) => ({ ...s, cards: { ...s.cards, [id]: reviewCard(s.cards[id], correct, today) } }))
        }}
        onExit={() => setScreen({ name: 'home' })}
        onFinish={(session) => {
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
    const { graded, firstWrong } = screen.session
    const rate = graded ? Math.round(((graded - firstWrong) / graded) * 100) : 100
    return (
      <main className="page result">
        {banners}
        <p className="result-lesson">{screen.title}</p>
        <h1>{DONE_TITLE[screen.kind]}</h1>
        <p className="result-xp">+{screen.xp} XP</p>
        <p>
          정답률 {rate}%{firstWrong === 0 ? ', 모두 맞혔습니다.' : `, ${firstWrong}문제를 틀렸습니다.`}
        </p>
        <p className="muted">연속 학습 {screen.streak}일째입니다.</p>
        <button className="primary" autoFocus onClick={() => setScreen({ name: 'home' })}>
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
      </header>

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
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </main>
  )
}
