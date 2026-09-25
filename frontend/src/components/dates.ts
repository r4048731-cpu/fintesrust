const longDate = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' })

/** «Четверг, 25 сентября». */
export function formatLongDate(d: Date): string {
  const text = longDate.format(d)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
