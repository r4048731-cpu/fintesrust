// Мост к напоминанию пить воду (только Android-версия, `android/.../water/WaterPlugin.kt`).

import { registerPlugin } from '@capacitor/core'
import { isAndroidApp } from './steps'

/** С `from` до `to` часов каждые `every` часов — если отстаёте от нормы. */
export interface WaterReminderSettings {
  enabled: boolean
  from: number
  to: number
  every: number
}

interface WaterPlugin {
  getReminder(): Promise<WaterReminderSettings>
  setReminder(options: WaterReminderSettings): Promise<void>
  setInfo(options: { date: string; ml: number; goal: number }): Promise<void>
  testReminder(): Promise<void>
}

export const Water = registerPlugin<WaterPlugin>('Water')

/** Сообщить телефону, сколько выпито за день и какая норма. Только Android; в старых APK метода нет. */
export function setWaterInfo(date: string, ml: number, goal: number): void {
  if (isAndroidApp()) void Water.setInfo({ date, ml, goal }).catch(() => {})
}
