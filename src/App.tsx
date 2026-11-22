import { useEffect, useState } from 'react'
import { lessons, units, type Lesson } from './content'
import LessonView from './LessonView'
import {
  lessonStates, lessonXp, localDate, loseHeart, nextHeartIn, refillHearts, shownStreak, touchStreak,
} from './lib/game'
import type { Session } from './lib/lesson'
import { STATE_KEY, load, save, type State } from './lib/state'

type Screen =
  | { name: 'home' }
  | { name: 'lesson'; lesson: Lesson; heartsOn: boolean }
  | { name: 'result'; lesson: Lesson; session: Session; xp: number; streak: number }
  | { name: 'failed'; lesson: Lesson }

// localStorage can throw when site data is blocked; then every save reports failure.
function storage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    window.localStorage.getItem(STATE_KEY)
    return window.localStorage
  } catch {
    return { getItem: () => null, setItem: () => { throw new Error('storage unavailable') } }
  }
}

const formatWait = (ms: number) => {
  const m = Math.ceil(ms / 60000)
  if (m < 60) return `${m}분`
  return m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m / 60}시간`
}

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

  const now = Date.now()
  const today = localDate(new Date(now))
  const hearts = refillHearts(state.hearts, now)
  const wait = nextHeartIn(state.hearts, now)

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

  if (screen.name === 'lesson') {
    const { lesson, heartsOn } = screen
    const pool = lessons.filter((l) => l === lesson || state.completedLessons.includes(l.id)).flatMap((l) => l.items)
    return (
      <LessonView
        key={lesson.id}
        lesson={lesson}
        pool={pool}
        heartsLeft={heartsOn ? hearts.count : null}
        onWrong={() => setState((s) => ({ ...s, hearts: loseHeart(s.hearts, Date.now()) }))}
        onFail={() => setScreen({ name: 'failed', lesson })}
        onExit={() => setScreen({ name: 'home' })}
        onFinish={(session) => {
          const firstTime = !state.completedLessons.includes(lesson.id)
          const xp = lessonXp(firstTime, session.firstWrong === 0)
          const streak = touchStreak(state.streak, today)
          setState((s) => ({
            ...s,
            xp: s.xp + xp,
            streak: touchStreak(s.streak, today),
            completedLessons: firstTime ? [...s.completedLessons, lesson.id] : s.completedLessons,
          }))
          setScreen({ name: 'result', lesson, session, xp, streak: streak.count })
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
        <p className="result-lesson">{screen.lesson.title}</p>
        <h1>레슨을 마쳤습니다</h1>
        <p className="result-xp">+{screen.xp} XP</p>
        <p>정답률 {rate}%{firstWrong === 0 ? ', 처음 풀 때 모두 맞혔습니다.' : `, 처음 풀 때 ${firstWrong}문제를 틀렸습니다.`}</p>
        <p className="muted">연속 학습 {screen.streak}일째입니다.</p>
        <button className="primary" autoFocus onClick={() => setScreen({ name: 'home' })}>
          홈으로
        </button>
      </main>
    )
  }

  if (screen.name === 'failed') {
    return (
      <main className="page result">
        {banners}
        <p className="result-lesson">{screen.lesson.title}</p>
        <h1>하트를 모두 써서 레슨을 끝냈습니다</h1>
        <p className="muted">
          {wait === null ? '하트가 다시 찼습니다.' : `${formatWait(wait)} 뒤에 하트 1개가 찹니다. 하트는 4시간마다 1개씩 찹니다.`}
        </p>
        <button className="primary" autoFocus onClick={() => setScreen({ name: 'home' })}>
          홈으로
        </button>
      </main>
    )
  }

  const states = lessonStates(lessons, state.completedLessons)
  const noCards = Object.keys(state.cards).length === 0
  const blocked = hearts.count === 0 && !noCards

  function start(lesson: Lesson) {
    // With no review cards yet there is no way to earn hearts back, so the limit is lifted (spec §6).
    setScreen({ name: 'lesson', lesson, heartsOn: hearts.count > 0 })
  }

  return (
    <main className="page">
      {banners}
      <header className="home-top">
        <span className="brand">hablemos</span>
        <dl className="stats">
          <div><dt>연속</dt><dd>{shownStreak(state.streak, today)}일</dd></div>
          <div><dt>하트</dt><dd>{hearts.count}</dd></div>
          <div><dt>XP</dt><dd>{state.xp}</dd></div>
        </dl>
      </header>
      {wait !== null && (
        <p className="heart-wait muted">
          {blocked
            ? `하트가 없어 새 레슨을 시작할 수 없습니다. ${formatWait(wait)} 뒤에 1개가 찹니다.`
            : `다음 하트까지 ${formatWait(wait)}`}
        </p>
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
                    <button onClick={() => !blocked && start(l)} aria-disabled={blocked}>
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
