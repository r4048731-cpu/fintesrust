// Картинка «Итоги месяца» для «Поделиться»: рисуется на canvas, 1080 × 1350 (4:5 — лента
// и сторис без обрезки). Всегда тёмная: так её одинаково видно в любом мессенджере.

import { monthDative, monthTitle, type MonthSummary } from '../domain/month'
import { formatRecordValue, RECORD_LABELS } from '../domain/metrics'
import { formatDecimal, formatInteger } from '../domain/number'
import { plural } from '../domain/plural'

const W = 1080
const H = 1350
const PAD = 84
const TITLE = 'Manrope'
const BODY = 'Manrope'
const INK = '#f4f2fa'
const MUTED = '#a29cb8'
const CARD = 'rgba(255,255,255,0.06)'
const CARD_LINE = 'rgba(255,255,255,0.10)'

/** «18,4 т» или «850 кг». */
export function formatTonnage(kg: number): string {
  return kg >= 1000
    ? `${formatDecimal(Math.round(kg / 100) / 10)} т`
    : `${formatInteger(Math.round(kg))} кг`
}

/** «9 ч 20 мин», «45 мин». */
export function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  const m = minutes % 60
  return m ? `${Math.floor(minutes / 60)} ч ${m} мин` : `${minutes / 60} ч`
}

/**
 * «+3 к сентябрю». Для идущего месяца — только рост: месяц ещё не закончился,
 * и «−6» в середине октября ничего не значит.
 */
export function deltaText(s: MonthSummary, prevMonth: string, ongoing = false): string {
  const d = s.workouts - s.prevWorkouts
  if (!d || !s.prevWorkouts || (ongoing && d < 0)) return ''
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} к ${monthDative(prevMonth)}`
}

/** «9,8 ч» — коротко для плитки. */
export function formatHoursShort(minutes: number): string {
  return minutes < 60 ? `${minutes} мин` : `${formatDecimal(Math.round(minutes / 6) / 10)} ч`
}

function gradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, '#5b8cff')
  g.addColorStop(0.5, '#a06bff')
  g.addColorStop(1, '#ff5fa2')
  return g
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | number[],
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Обрезает строку с многоточием, чтобы влезла в ширину. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

export async function renderMonthImage(
  s: MonthSummary,
  prevMonth: string,
  nameOf: (exerciseId: string) => string,
  ongoing = false,
): Promise<Blob> {
  await Promise.all(
    [`800 100px ${TITLE}`, `800 40px ${TITLE}`, `400 32px ${BODY}`, `600 32px ${BODY}`].map((f) =>
      document.fonts?.load(f).catch(() => null),
    ),
  )
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Не удалось нарисовать картинку')

  // фон: глубокий фиолетовый, два мягких свечения и сетка-миллиметровка
  ctx.fillStyle = '#0e0b18'
  ctx.fillRect(0, 0, W, H)
  for (const [x, y, r, c] of [
    [140, 120, 620, 'rgba(124,58,237,0.42)'],
    [1000, 1250, 680, 'rgba(219,39,119,0.30)'],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, c)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 54) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, H)
    ctx.stroke()
  }
  for (let y = 0; y <= H; y += 54) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(W, y + 0.5)
    ctx.stroke()
  }

  ctx.textBaseline = 'alphabetic'
  let y = PAD + 30

  // шапка
  ctx.fillStyle = MUTED
  ctx.font = `600 30px ${BODY}`
  ctx.letterSpacing = '6px'
  ctx.fillText('ИТОГИ МЕСЯЦА', PAD, y)
  ctx.letterSpacing = '0px'
  const [month, year] = monthTitle(s.month).split(' ')
  y += 112
  ctx.fillStyle = INK
  ctx.font = `800 96px ${TITLE}`
  ctx.fillText(month, PAD, y)
  const mw = ctx.measureText(month).width
  ctx.font = `800 52px ${TITLE}`
  ctx.fillStyle = gradient(ctx, PAD + mw, y - 50, PAD + mw + 200, y)
  ctx.fillText(` ${year}`, PAD + mw, y)

  // главная цифра — тренировки
  y += 236
  ctx.font = `800 210px ${TITLE}`
  ctx.fillStyle = gradient(ctx, PAD, y - 180, PAD + 420, y)
  const n = String(s.workouts)
  ctx.fillText(n, PAD - 6, y)
  const nw = ctx.measureText(n).width
  ctx.fillStyle = INK
  ctx.font = `600 44px ${BODY}`
  ctx.fillText(plural(s.workouts, 'тренировка', 'тренировки', 'тренировок'), PAD + nw + 24, y - 100)
  ctx.fillStyle = MUTED
  ctx.font = `400 32px ${BODY}`
  const sub = [
    `${s.days} ${plural(s.days, 'день', 'дня', 'дней')} в зале`,
    deltaText(s, prevMonth, ongoing),
  ]
    .filter(Boolean)
    .join(' · ')
  ctx.fillText(sub, PAD + nw + 24, y - 44)

  // три плитки
  y += 60
  const tiles = [
    ['Тоннаж', formatTonnage(s.tonnageKg)],
    ['Подходы', formatInteger(s.sets)],
    ['Время', formatHours(s.minutes)],
  ]
  const gap = 20
  const tw = (W - PAD * 2 - gap * 2) / 3
  tiles.forEach(([label, value], i) => {
    const x = PAD + i * (tw + gap)
    roundRect(ctx, x, y, tw, 150, 28)
    ctx.fillStyle = CARD
    ctx.fill()
    ctx.strokeStyle = CARD_LINE
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = MUTED
    ctx.font = `400 28px ${BODY}`
    ctx.fillText(label, x + 28, y + 52)
    ctx.fillStyle = INK
    ctx.font = `800 ${value.length > 8 ? 34 : 42}px ${TITLE}`
    ctx.fillText(fit(ctx, value, tw - 56), x + 28, y + 114)
  })
  y += 150 + 76

  // рекорды
  ctx.fillStyle = INK
  ctx.font = `800 40px ${TITLE}`
  ctx.fillText('Рекорды', PAD, y)
  if (s.records.length) {
    ctx.fillStyle = MUTED
    ctx.font = `400 30px ${BODY}`
    ctx.textAlign = 'right'
    ctx.fillText(`всего ${s.records.length}`, W - PAD, y)
    ctx.textAlign = 'left'
  }
  y += 28
  // три рекорда — больше не влезает вместе с нижними строками; всего — числом в заголовке
  const shown = s.records.slice(0, 3)
  if (!shown.length) {
    y += 48
    ctx.fillStyle = MUTED
    ctx.font = `400 32px ${BODY}`
    ctx.fillText('В этом месяце без рекордов — значит, всё впереди', PAD, y)
    y += 30
  }
  for (const r of shown) {
    roundRect(ctx, PAD, y, W - PAD * 2, 96, 24)
    ctx.fillStyle = CARD
    ctx.fill()
    // значок: градиентный кружок с кубком из двух фигур
    const cx = PAD + 50
    const cy = y + 48
    ctx.beginPath()
    ctx.arc(cx, cy, 28, 0, Math.PI * 2)
    const g = ctx.createLinearGradient(cx - 28, cy - 28, cx + 28, cy + 28)
    g.addColorStop(0, '#fbbf24')
    g.addColorStop(1, '#f97316')
    ctx.fillStyle = g
    ctx.fill()
    ctx.fillStyle = '#fff'
    roundRect(ctx, cx - 11, cy - 13, 22, 16, [0, 0, 11, 11])
    ctx.fill()
    ctx.fillRect(cx - 2, cy + 2, 4, 7)
    ctx.fillRect(cx - 8, cy + 9, 16, 4)

    const value = formatRecordValue(r.kind, r.value)
    ctx.font = `800 34px ${TITLE}`
    const vw = ctx.measureText(value).width
    ctx.textAlign = 'right'
    ctx.fillStyle = INK
    ctx.fillText(value, W - PAD - 28, y + 50)
    ctx.fillStyle = MUTED
    ctx.font = `400 24px ${BODY}`
    ctx.fillText(`было ${formatRecordValue(r.kind, r.previous)}`, W - PAD - 28, y + 80)
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    ctx.font = `600 32px ${BODY}`
    const textX = PAD + 100
    const room = W - PAD - 28 - vw - 24 - textX
    ctx.fillText(fit(ctx, nameOf(r.exerciseId), room), textX, y + 46)
    ctx.fillStyle = MUTED
    ctx.font = `400 24px ${BODY}`
    ctx.fillText(RECORD_LABELS[r.kind], textX, y + 78)
    y += 96 + 14
  }

  // низ: любимое упражнение, пробежки и подпись
  const facts = [
    s.top &&
      `Чаще всего: ${nameOf(s.top.exerciseId)} — ${s.top.sets} ${plural(s.top.sets, 'подход', 'подхода', 'подходов')}`,
    s.runs > 0 &&
      `Бег и ходьба: ${formatDecimal(Math.round(s.runKm * 10) / 10)} км за ${s.runs} ${plural(s.runs, 'раз', 'раза', 'раз')}`,
  ].filter((f): f is string => !!f)
  let fy = y + 44
  ctx.font = `400 30px ${BODY}`
  for (const f of facts) {
    ctx.fillStyle = INK
    ctx.fillText(fit(ctx, f, W - PAD * 2), PAD, fy)
    fy += 46
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(PAD, H - PAD - 50, W - PAD * 2, 2)
  ctx.font = `800 34px ${TITLE}`
  ctx.fillStyle = gradient(ctx, PAD, 0, PAD + 200, 0)
  ctx.fillText('fitnes', PAD, H - PAD + 6)
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = `400 28px ${BODY}`
  ctx.fillText('мой дневник тренировок', W - PAD, H - PAD + 4)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Не удалось сохранить картинку'))),
      'image/png',
    ),
  )
}
