import type { ReactNode } from 'react'
import styles from './Ai.module.css'

/** **жирный** внутри строки. */
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part,
    )
}

/**
 * Простая разметка ответов моделей: абзацы, списки «- » и «1. », заголовки «#», таблицы, **жирный**.
 * Без HTML из ответа — только текст, поэтому безопасно.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const items = list.items.map((t, i) => <li key={i}>{inline(t)}</li>)
    blocks.push(
      list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>,
    )
    list = null
  }
  const lines = text.split('\n')
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trimEnd()
    // таблица: строки «| a | b |», вторая — разделитель «|---|---|»
    if (
      line.trim().startsWith('|') &&
      /^\s*\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/.test(lines[n + 1] ?? '')
    ) {
      flush()
      const cells = (l: string) =>
        l
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim())
      const head = cells(line)
      const rows: string[][] = []
      n += 2
      while (n < lines.length && lines[n].trim().startsWith('|')) rows.push(cells(lines[n++]))
      n--
      blocks.push(
        <div key={blocks.length} className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {head.map((c, i) => (
                  <th key={i}>{inline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{inline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const number = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || number) {
      const ordered = !!number
      if (!list || list.ordered !== ordered) {
        flush()
        list = { ordered, items: [] }
      }
      list.items.push((bullet ?? number)![1])
      continue
    }
    flush()
    if (!line.trim()) continue
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    blocks.push(
      heading ? (
        <p key={blocks.length}>
          <b>{inline(heading[1])}</b>
        </p>
      ) : (
        <p key={blocks.length}>{inline(line)}</p>
      ),
    )
  }
  flush()
  return <>{blocks}</>
}
