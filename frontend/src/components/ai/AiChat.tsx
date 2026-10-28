import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useRepos } from '../../app/dataContext'
import { buildAiContext } from '../../data/aiContext'
import { AiError, chat, QUICK_PROMPTS, SYSTEM_PROMPT, type AiMessage } from '../../domain/ai'
import { Button } from '../Button'
import { Markdown } from './markdown'
import styles from './Ai.module.css'

/** Сколько сообщений хранить и сколько последних отправлять модели. */
const KEEP = 60
const SEND = 16

/** Время сообщения; вызывается только из обработчиков, не при отрисовке. */
const stamp = () => Date.now()

/** Переписка с помощником: вопросы, ответы по мере генерации, «Стоп», готовые вопросы. */
export function AiChat() {
  const repos = useRepos()
  const data = useLiveQuery(async () => {
    const [messages, useContext] = await Promise.all([
      repos.meta.get('aiChat'),
      repos.meta.get('aiUseContext'),
    ])
    return { messages, useContext }
  }, [repos])
  const [text, setText] = useState('')
  /** Ответ, который сейчас печатается. */
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [data?.messages.length, draft])
  useEffect(() => () => abort.current?.abort(), [])

  if (!data) return null
  const { messages, useContext } = data
  const busy = draft !== null

  async function save(list: AiMessage[]) {
    await repos.meta.set('aiChat', list.slice(-KEEP))
  }

  async function send(question: string) {
    const q = question.trim()
    if (!q || busy) return
    setError(null)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError('Нет интернета — помощнику нужна связь.')
      return
    }
    const asked: AiMessage = { role: 'user', content: q, at: stamp() }
    const history = [...messages, asked]
    setText('')
    await save(history)

    const system = useContext
      ? `${SYSTEM_PROMPT}\n\nДанные пользователя из приложения:\n${await buildAiContext(repos)}`
      : SYSTEM_PROMPT
    const controller = new AbortController()
    abort.current = controller
    let got = ''
    setDraft('')
    try {
      const result = await chat({
        signal: controller.signal,
        messages: [
          { role: 'system', content: system },
          ...history.slice(-SEND).map((m) => ({ role: m.role, content: m.content })),
        ],
        onDelta: (piece) => {
          got += piece
          setDraft(got)
        },
      })
      await save([
        ...history,
        { role: 'assistant', content: result.text, model: result.model, at: stamp() },
      ])
    } catch (err) {
      if (controller.signal.aborted) {
        if (got.trim()) {
          await save([
            ...history,
            { role: 'assistant', content: `${got}\n\n(остановлено)`, at: stamp() },
          ])
        }
      } else {
        setError(err instanceof AiError ? err.message : 'Не удалось получить ответ.')
      }
    } finally {
      abort.current = null
      setDraft(null)
    }
  }

  return (
    <div className={styles.chat}>
      <div className={styles.messages} aria-label="Переписка" aria-live="polite">
        {messages.length === 0 && !busy && (
          <div className={styles.quick} role="group" aria-label="Готовые вопросы">
            {QUICK_PROMPTS.map((p) => (
              <button key={p} type="button" className={styles.chip} onClick={() => send(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={`${m.at}-${i}`} className={m.role === 'user' ? styles.user : styles.assistant}>
            {m.role === 'user' ? m.content : <Markdown text={m.content} />}
            {m.model && <span className={styles.model}>{m.model}</span>}
          </div>
        ))}
        {busy && (
          <div className={styles.assistant} role="status">
            {draft ? <Markdown text={draft} /> : <span className={styles.typing}>Думаю…</span>}
          </div>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div ref={end} />
      </div>

      <label className={styles.context}>
        <input
          type="checkbox"
          checked={useContext}
          onChange={(e) => repos.meta.set('aiUseContext', e.target.checked)}
        />
        Учитывать мои данные: тренировки, вес, питание
      </label>
      <p className={styles.muted}>
        Бесплатные модели Pollinations и LLM7 — без ключей и регистрации, но с ограничением частоты.
        Вопросы уходят этим сервисам; не пишите в чат личные данные.
      </p>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        <textarea
          className={styles.input}
          value={text}
          rows={2}
          placeholder="Спросите тренера…"
          aria-label="Вопрос помощнику"
          onChange={(e) => setText(e.target.value)}
        />
        {busy ? (
          <Button variant="secondary" onClick={() => abort.current?.abort()}>
            Стоп
          </Button>
        ) : (
          <Button type="submit" iconAfter="arrow" variant="primary" disabled={!text.trim()}>
            Отправить
          </Button>
        )}
      </form>

      {messages.length > 0 && !busy && (
        <Button size="sm" variant="ghost" onClick={() => save([])}>
          Очистить переписку
        </Button>
      )}
    </div>
  )
}
