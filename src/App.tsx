import { useState } from 'react'
import { lessons, units, type Lesson } from './content'
import LessonView from './LessonView'
import type { Session } from './lib/lesson'

type Screen =
  | { name: 'home' }
  | { name: 'lesson'; lesson: Lesson }
  | { name: 'result'; lesson: Lesson; session: Session }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  // shortcut: in-memory only and every lesson open, until M2 adds saved progress and unlocking.
  const [completed, setCompleted] = useState<string[]>([])

  if (screen.name === 'lesson') {
    const { lesson } = screen
    const pool = lessons.filter((l) => l === lesson || completed.includes(l.id)).flatMap((l) => l.items)
    return (
      <LessonView
        key={lesson.id}
        lesson={lesson}
        pool={pool}
        onExit={() => setScreen({ name: 'home' })}
        onFinish={(session) => {
          setCompleted((c) => (c.includes(lesson.id) ? c : [...c, lesson.id]))
          setScreen({ name: 'result', lesson, session })
        }}
      />
    )
  }

  if (screen.name === 'result') {
    const { graded, firstWrong } = screen.session
    const rate = graded ? Math.round(((graded - firstWrong) / graded) * 100) : 100
    return (
      <main className="page result">
        <p className="result-lesson">{screen.lesson.title}</p>
        <h1>레슨을 마쳤습니다</h1>
        <p className="result-rate">정답률 {rate}%</p>
        <p className="muted">{firstWrong === 0 ? '처음 풀 때 모두 맞혔습니다.' : `처음 풀 때 ${firstWrong}문제를 틀렸습니다.`}</p>
        <button className="primary" autoFocus onClick={() => setScreen({ name: 'home' })}>
          홈으로
        </button>
      </main>
    )
  }

  const next = lessons.find((l) => !completed.includes(l.id))

  return (
    <main className="page">
      <header className="home-top">
        <span className="brand">hablemos</span>
      </header>
      {units.map((u) => (
        <section key={u.id} className="unit" aria-labelledby={`${u.id}-title`}>
          <h2 id={`${u.id}-title`}>{u.title}</h2>
          <p className="muted">{u.description}</p>
          <ol className="path">
            {u.lessons.map((l) => {
              const state = completed.includes(l.id) ? 'done' : l === next ? 'next' : 'open'
              return (
                <li key={l.id} className={`node ${state}`}>
                  <button onClick={() => setScreen({ name: 'lesson', lesson: l })}>
                    <span className="dot" aria-hidden="true">
                      <span className="ring">{state === 'done' ? '✓' : ''}</span>
                    </span>
                    <span className="node-title">{l.title}</span>
                    {state === 'done' && <span className="node-state">완료</span>}
                    {state === 'next' && <span className="start">{completed.length ? '이어서 시작' : '시작'}</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </main>
  )
}
