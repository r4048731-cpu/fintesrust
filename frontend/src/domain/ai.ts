// ИИ-помощник на бесплатных моделях без ключей и регистрации. Сервера у приложения нет:
// запросы идут прямо из браузера к открытым сервисам, оба понимают формат OpenAI
// /chat/completions и разрешают вызов из браузера (CORS). У бесплатного доступа есть
// ограничение частоты, поэтому моделей две: если первая не ответила — отвечает вторая.

export type ProviderId = 'pollinations' | 'llm7'

export interface Provider {
  id: ProviderId
  name: string
  /** Адрес /chat/completions. */
  chatUrl: string
  /** Модель, доступная без ключа. */
  model: string
  /** Как модель подписывается под ответом. */
  label: string
}

/** Порядок важен: первая отвечает, вторая — запасная. */
export const PROVIDERS: Provider[] = [
  {
    id: 'pollinations',
    name: 'Pollinations',
    chatUrl: 'https://text.pollinations.ai/openai',
    model: 'openai-fast',
    label: 'Pollinations · GPT-OSS 20B',
  },
  {
    id: 'llm7',
    name: 'LLM7',
    chatUrl: 'https://api.llm7.io/v1/chat/completions',
    model: 'default',
    label: 'LLM7',
  },
]

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  /** Какая модель ответила — показывается под ответом. */
  model?: string
  at: number
}

export type Fetch = typeof fetch

/** Ошибка, после которой есть смысл попробовать следующую модель. */
export class AiError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

function explain(status: number): string {
  if (status === 401 || status === 402 || status === 403) return 'бесплатный доступ закрыт'
  if (status === 404) return 'модель больше недоступна'
  if (status === 429) return 'кончился лимит запросов'
  if (status >= 500) return 'провайдер сейчас не отвечает'
  return `ошибка ${status}`
}

export const SYSTEM_PROMPT = [
  'Ты — персональный тренер и нутрициолог в приложении «Фитнес».',
  'Отвечай по-русски, коротко и по делу: списки, конкретные веса, подходы, граммы.',
  'Ответ читают на узком экране телефона: без таблиц, не больше 10–12 строк.',
  'Опирайся на данные пользователя, если они даны. Не придумывай то, чего в данных нет.',
  'Ты не врач: при боли, травмах и болезнях советуй обратиться к специалисту.',
].join(' ')

interface ChatOptions {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  signal?: AbortSignal
  /** Новый кусок ответа по мере генерации. */
  onDelta: (text: string) => void
  /** Какие модели и в каком порядке; по умолчанию — все бесплатные. */
  providers?: Provider[]
  fetchImpl?: Fetch
}

/**
 * Отправляет переписку первой модели и читает ответ по частям (стриминг).
 * Если модель не ответила — лимит, сбой, нет связи — запрос уходит следующей.
 * Если ответ уже начал печататься, на запасную модель не переключаемся.
 */
export async function chat({
  messages,
  signal,
  onDelta,
  providers = PROVIDERS,
  fetchImpl = fetch,
}: ChatOptions): Promise<{ model: string; text: string; skipped: string[] }> {
  const skipped: string[] = []
  for (const p of providers) {
    let text = ''
    try {
      const res = await fetchImpl(p.chatUrl, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: p.model, messages, stream: true }),
      })
      if (!res.ok || !res.body) throw new AiError(explain(res.status), res.status)
      for await (const piece of readStream(res.body)) {
        text += piece
        onDelta(piece)
      }
      if (!text.trim()) throw new AiError('пустой ответ')
      return { model: p.label, text, skipped }
    } catch (err) {
      if (signal?.aborted) throw err
      if (text) return { model: p.label, text, skipped } // оборвалось на середине — оставляем, что есть
      skipped.push(`${p.label}: ${err instanceof AiError ? err.message : 'нет связи'}`)
    }
  }
  throw new AiError(
    `Бесплатные модели сейчас не отвечают — попробуйте через минуту.\n${skipped.join('\n')}`,
  )
}

/** Разбор потока server-sent events: строки `data: {...}`, конец — `data: [DONE]`. */
async function* readStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const data = line.trim()
      if (!data.startsWith('data:')) continue
      const payload = data.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[]
          error?: { message?: string }
        }
        if (json.error) throw new AiError(json.error.message ?? 'ошибка провайдера')
        const piece = json.choices?.[0]?.delta?.content
        if (piece) yield piece
      } catch (err) {
        if (err instanceof AiError) throw err
        // неполная или служебная строка — пропускаем
      }
    }
  }
}

/** Готовые вопросы на пустом экране чата. */
export const QUICK_PROMPTS = [
  'Разбери мою последнюю тренировку',
  'Что съесть сегодня, чтобы добрать белок?',
  'Составь программу на неделю: 3 тренировки',
  'Почему вес стоит на месте?',
]
