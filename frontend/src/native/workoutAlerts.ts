// Мост к нативной вибрации и будильнику конца отдыха (только Android-версия,
// `android/.../workout/WorkoutAlertsPlugin.kt`). В WebView нет navigator.vibrate,
// а таймер страницы засыпает вместе с экраном — поэтому будильник ставит система.

import { registerPlugin } from '@capacitor/core'
import { isAndroidApp } from './steps'

interface WorkoutAlertsPlugin {
  vibrate(options: { pattern: number[] }): Promise<void>
  scheduleRest(options: { at: number; text: string }): Promise<void>
  cancelRest(): Promise<void>
}

const WorkoutAlerts = registerPlugin<WorkoutAlertsPlugin>('WorkoutAlerts')

/** Вибрация: нативная в Android-версии, navigator.vibrate в браузере. */
export function vibrate(pattern: number[]): void {
  if (isAndroidApp()) {
    void WorkoutAlerts.vibrate({ pattern }).catch(() => {})
    return
  }
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // вибрация недоступна
  }
}

/** Поставить будильник конца отдыха; повторный вызов переставляет его. Только Android. */
export function scheduleRestAlarm(at: number, text: string): void {
  if (isAndroidApp()) void WorkoutAlerts.scheduleRest({ at, text }).catch(() => {})
}

export function cancelRestAlarm(): void {
  if (isAndroidApp()) void WorkoutAlerts.cancelRest().catch(() => {})
}

/** Звонит ли конец отдыха сам телефон — тогда страница не дублирует сигнал. */
export const nativeRestAlarm = isAndroidApp
