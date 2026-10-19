const longDate = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' })

/** «Четверг, 25 сентября». */
export function formatLongDate(d: Date): string {
  const text = longDate.format(d)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** «пятница, 25 сентября» — для середины фразы. */
export function formatLongDateInline(d: Date): string {
  return longDate.format(d)
}

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

/** «25 сен» из «2026-09-25». */
export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`
}
