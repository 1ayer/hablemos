import { useState, type ChangeEvent, type FormEvent } from 'react'
import { DEFAULT_MODEL, MODEL_SUGGESTIONS, isModelId } from './lib/gemini'
import type { State } from './lib/state'

type Props = {
  settings: State['settings']
  apiKey: string
  aiCount: number
  onSaveKey: (key: string) => boolean
  onDeleteKey: () => void
  onSettings: (patch: Partial<State['settings']>) => void
  onDeleteAi: () => void
  onReset: () => void
  onExport: () => void
  /** Returns an error message, or null when the file replaced the progress. */
  onImport: (text: string) => string | null
  onBack: () => void
}

export default function Settings({ settings, apiKey, aiCount, onSaveKey, onDeleteKey, onSettings, onDeleteAi, onReset, onExport, onImport, onBack }: Props) {
  const [keyInput, setKeyInput] = useState('')
  const [keyMsg, setKeyMsg] = useState<string | null>(null)
  const [model, setModel] = useState(settings.geminiModel || DEFAULT_MODEL)
  const [modelMsg, setModelMsg] = useState<string | null>(null)
  const [dataMsg, setDataMsg] = useState<string | null>(null)

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again
    if (!file) return
    if (file.size > 2_000_000) return setDataMsg('파일이 너무 큽니다. hablemos에서 내보낸 파일인지 확인하세요.')
    if (!confirm('지금 진도를 이 파일의 진도로 바꿀까요? 되돌릴 수 없습니다.')) return
    setDataMsg(onImport(await file.text()) ?? '진도를 가져왔습니다.')
  }

  function saveKey(e: FormEvent) {
    e.preventDefault()
    const k = keyInput.trim()
    if (!k || /\s/.test(k)) return setKeyMsg('키를 공백 없이 입력하세요.')
    setKeyMsg(onSaveKey(k) ? '키를 저장했습니다.' : '키를 저장하지 못했습니다. 브라우저의 사이트 데이터 설정을 확인하세요.')
    setKeyInput('')
  }

  function saveModel(e: FormEvent) {
    e.preventDefault()
    const m = model.trim()
    if (!isModelId(m)) return setModelMsg('모델 ID는 영문 소문자, 숫자, 점, 하이픈만 쓸 수 있습니다.')
    onSettings({ geminiModel: m === DEFAULT_MODEL ? '' : m })
    setModelMsg('모델을 저장했습니다.')
  }

  return (
    <main className="page settings">
      <header className="sub-top">
        <button type="button" className="exit" aria-label="홈으로" onClick={onBack}>
          ←
        </button>
        <h1>설정</h1>
      </header>

      <section aria-labelledby="key-title">
        <h2 id="key-title">Gemini API 키</h2>
        <p className="muted">
          AI 연습과 대화 연습에 씁니다. 키가 없어도 레슨과 복습은 그대로 쓸 수 있습니다. 키는{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>
          에서 무료로 만들 수 있습니다.
        </p>
        {apiKey ? (
          <div className="key-row">
            <p>
              저장된 키: ····{apiKey.slice(-4)}
            </p>
            <button type="button" className="secondary" onClick={() => { onDeleteKey(); setKeyMsg('키를 지웠습니다.') }}>
              키 지우기
            </button>
          </div>
        ) : (
          <form className="field-row" onSubmit={saveKey}>
            <label className="sr-only" htmlFor="api-key">Gemini API 키</label>
            <input id="api-key" className="answer" type="password" autoComplete="off" spellCheck={false} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
            <button type="submit" className="primary">저장</button>
          </form>
        )}
        {keyMsg && <p role="status">{keyMsg}</p>}
        <ul className="fine">
          <li>키는 이 브라우저에만 저장되고, 요청할 때 Gemini로 직접 전송됩니다. 같은 주소에서 열린 다른 페이지의 스크립트도 읽을 수 있으니 이 앱 전용 키를 쓰세요.</li>
          <li>무료 키로 보낸 내용은 Google 제품 개선에 쓰일 수 있습니다. 대화 연습에 개인정보를 적지 마세요.</li>
          <li>무료 사용 한도는 Google AI Studio에서 확인할 수 있습니다.</li>
        </ul>
      </section>

      <section aria-labelledby="model-title">
        <h2 id="model-title">모델</h2>
        <form className="field-row" onSubmit={saveModel}>
          <label className="sr-only" htmlFor="model">모델 ID</label>
          <input id="model" className="answer" list="models" spellCheck={false} value={model} onChange={(e) => { setModel(e.target.value); setModelMsg(null) }} />
          <datalist id="models">
            {MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
          </datalist>
          <button type="submit" className="secondary">저장</button>
        </form>
        <p className="muted">기본값은 무료 등급에서 쓸 수 있는 {DEFAULT_MODEL}입니다.</p>
        {modelMsg && <p role="status">{modelMsg}</p>}
      </section>

      <section aria-labelledby="audio-title">
        <h2 id="audio-title">음성</h2>
        <label className="check">
          <input type="checkbox" checked={settings.audio} onChange={(e) => onSettings({ audio: e.target.checked })} />
          듣기·말하기 문제 내기
        </label>
      </section>

      <section aria-labelledby="data-title">
        <h2 id="data-title">학습 기록</h2>
        <p className="muted">진도는 이 브라우저에만 저장됩니다. 다른 기기로 옮기거나 백업하려면 파일로 내보내세요. API 키는 파일에 들어가지 않습니다.</p>
        <div className="danger-row">
          <button type="button" className="secondary" onClick={() => { onExport(); setDataMsg('진도 파일을 내려받았습니다.') }}>
            진도 내보내기
          </button>
          <label className="secondary file-btn">
            진도 가져오기
            <input type="file" accept="application/json,.json" className="sr-only" onChange={importFile} />
          </label>
        </div>
        {dataMsg && <p role="status">{dataMsg}</p>}
        <div className="danger-row">
          <button
            type="button"
            className="secondary"
            disabled={aiCount === 0}
            onClick={() => confirm(`AI가 만든 문장 ${aiCount}개와 그 복습 기록을 지울까요?`) && onDeleteAi()}
          >
            AI 문장 {aiCount}개 지우기
          </button>
          <button type="button" className="secondary danger" onClick={() => confirm('진도, XP, 복습 기록을 모두 지울까요? 되돌릴 수 없습니다. API 키는 남습니다.') && onReset()}>
            진도 초기화
          </button>
        </div>
      </section>
    </main>
  )
}
