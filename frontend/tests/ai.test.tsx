// @vitest-environment jsdom
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataProvider } from '../src/app/DataProvider'
import { AiChat } from '../src/components/ai/AiChat'
import { Markdown } from '../src/components/ai/markdown'
import { chat, PROVIDERS } from '../src/domain/ai'
import { setup } from './helpers'

/** Поток server-sent events, как у OpenAI-совместимых API; reasoning — служебные куски. */
function sse(pieces: string[]): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(
        enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { reasoning: 'думаю' } }] })}\n\n`),
      )
      for (const p of pieces) {
        c.enqueue(
          enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`),
        )
      }
      c.enqueue(enc.encode('data: [DONE]\n\n'))
      c.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('ИИ-помощник', () => {
  it('без ключей: первая модель упёрлась в лимит — отвечает запасная', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push(url)
      // ключ не передаётся
      expect(new Headers(init.headers).get('Authorization')).toBeNull()
      return url.includes('pollinations')
        ? new Response('{"error":"rate"}', { status: 429 })
        : sse(['При', 'вет'])
    }) as unknown as typeof fetch
    const pieces: string[] = []
    const result = await chat({
      messages: [{ role: 'user', content: 'привет' }],
      onDelta: (p) => pieces.push(p),
      fetchImpl,
    })
    expect(result).toMatchObject({ text: 'Привет', model: 'LLM7' })
    expect(pieces).toEqual(['При', 'вет'])
    expect(result.skipped).toEqual(['Pollinations · GPT-OSS 20B: кончился лимит запросов'])
    expect(calls).toEqual(PROVIDERS.map((p) => p.chatUrl))

    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(chat({ messages: [], onDelta: () => {}, fetchImpl: down })).rejects.toThrow(
      /не отвечают/,
    )
  })

  it('чат (готов, пока не подключён): готовый вопрос → ответ с моими данными; без галочки данные не уходят', async () => {
    const r = await setup()
    await r.bodyWeights.record(80)
    const sent: { messages: { role: string; content: string }[] }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        sent.push(JSON.parse(String(init!.body)))
        return sse(['Делайте ', '**3 подхода**.'])
      }),
    )
    // чат готов, но пока не подключён к кнопке «ИИ» — проверяем его напрямую
    render(
      <DataProvider repos={r}>
        <AiChat />
      </DataProvider>,
    )
    const user = userEvent.setup()
    const sheet = document.body
    await user.click(
      await within(sheet).findByRole('button', { name: 'Разбери мою последнюю тренировку' }),
    )
    const log = within(sheet).getByLabelText('Переписка')
    // черновик ответа сменяется сохранённым сообщением — проверяем текст переписки целиком
    await waitFor(() => expect(log).toHaveTextContent('Делайте 3 подхода.'))
    await waitFor(() => expect(log).toHaveTextContent('Pollinations · GPT-OSS 20B'))
    expect(sent[0].messages[0].content).toMatch(/Вес тела: .* 80 кг/)
    expect(sent[0].messages.at(-1)).toEqual({
      role: 'user',
      content: 'Разбери мою последнюю тренировку',
    })
    await waitFor(async () => expect(await r.meta.get('aiChat')).toHaveLength(2))

    await user.click(within(sheet).getByLabelText(/Учитывать мои данные/))
    await user.type(within(sheet).getByLabelText('Вопрос помощнику'), 'Сколько пить воды?')
    await user.click(within(sheet).getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1].messages[0].content).not.toMatch(/Вес тела/)
    // в истории — прошлые сообщения, чтобы модель помнила разговор
    expect(sent[1].messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
  })

  it('разметка ответа: список, жирный, таблица — без HTML из ответа', () => {
    const { container } = render(
      <Markdown
        text={
          '**План**\n- яйца\n- творог\n\n| Еда | Белок |\n|---|---|\n| Курица | 30 г |\n\n<b>нет</b>'
        }
      />,
    )
    expect(container.querySelector('b')).toHaveTextContent('План')
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelector('table')).toHaveTextContent('ЕдаБелокКурица30 г')
    // HTML из ответа показывается как текст, а не разметка
    expect(container).toHaveTextContent('<b>нет</b>')
  })
})
