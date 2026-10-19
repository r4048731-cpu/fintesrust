// Сигналы: конец отдыха (два коротких гудка и вибрация) и фазы интервального таймера.
// Звук в браузере разрешён только после касания пользователя, поэтому AudioContext
// создаётся заранее — в обработчике нажатия «подход выполнен» (unlockAudio).
// На iPhone вибрации в браузере нет, а беззвучный режим глушит звук: остаётся цвет таймера.
// В Android-версии конец отдыха объявляет системный будильник (native/workoutAlerts).

import { nativeRestAlarm, vibrate } from '../native/workoutAlerts'

let ctx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

/** Гудки одной частоты: `offsets` — когда каждый начинается, с. */
function beep(frequency: number, offsets: number[], lengthSec = 0.2): void {
  if (!ctx) return
  for (const offset of offsets) {
    const t = ctx.currentTime + offset
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + lengthSec)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + lengthSec + 0.02)
  }
}

export function restEndSignal(): void {
  if (nativeRestAlarm()) return
  vibrate([200, 100, 200])
  beep(880, [0, 0.28])
}

export type IntervalSignal = 'tick' | 'work' | 'rest' | 'finish'

/**
 * Сигналы интервального таймера: тиканье на последних трёх секундах,
 * высокий длинный гудок — работа, два низких — отдых, три — конец.
 */
export function intervalSignal(kind: IntervalSignal): void {
  switch (kind) {
    case 'tick':
      beep(660, [0], 0.08)
      vibrate([40])
      return
    case 'work':
      beep(1046, [0], 0.45)
      vibrate([350])
      return
    case 'rest':
      beep(523, [0, 0.25])
      vibrate([150, 80, 150])
      return
    case 'finish':
      beep(1046, [0, 0.3, 0.6], 0.25)
      vibrate([300, 120, 300, 120, 500])
  }
}

/** Короткий отклик на отметку подхода (Android). */
export function tapFeedback(): void {
  vibrate([25])
}
