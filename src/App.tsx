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
        <h1>레슨 완료</h1>
        <p className="result-lesson">{screen.lesson.title}</p>
        <p className="result-rate">
          정답률 <strong>{rate}%</strong>
        </p>
        <p>{firstWrong === 0 ? '첫 시도에 모두 맞혔습니다.' : `처음에 ${firstWrong}문제를 틀렸습니다.`}</p>
        <button className="primary" autoFocus onClick={() => setScreen({ name: 'home' })}>
          홈으로
        </button>
      </main>
    )
  }

  return (
    <main className="page">
      <h1 className="brand">hablemos</h1>
      {units.map((u) => (
        <section key={u.id} className="unit">
          <h2>{u.title}</h2>
          <p className="unit-desc">{u.description}</p>
          <ol className="path">
            {u.lessons.map((l) => (
              <li key={l.id}>
                <button className="lesson-node" onClick={() => setScreen({ name: 'lesson', lesson: l })}>
                  <span>{l.title}</span>
                  {completed.includes(l.id) && <span className="done">완료</span>}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  )
}
