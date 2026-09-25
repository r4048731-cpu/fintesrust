// Сигнал конца отдыха: два коротких гудка и вибрация.
// Звук в браузере разрешён только после касания пользователя, поэтому AudioContext
// создаётся заранее — в обработчике нажатия «подход выполнен» (unlockAudio).
// На iPhone вибрации в браузере нет, а беззвучный режим глушит звук: остаётся цвет таймера.

let ctx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export function restEndSignal(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // вибрация недоступна
  }
  if (!ctx) return
  for (const offset of [0, 0.28]) {
    const t = ctx.currentTime + offset
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.22)
  }
}

/** Короткий отклик на отметку подхода (Android). */
export function tapFeedback(): void {
  try {
    navigator.vibrate?.(25)
  } catch {
    // вибрация недоступна
  }
}
