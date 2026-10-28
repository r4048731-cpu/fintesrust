// Мост к нативному модулю шагов (только Android-версия, `android/.../steps/StepsPlugin.kt`).
// В браузере шагов нет: веб-приложению недоступен шагомер телефона и работа в фоне.

import { Capacitor, registerPlugin } from '@capacitor/core'

export interface StepsStatus {
  /** available — можно читать; not_installed / update_required — нужен Health Connect. */
  health: 'available' | 'not_installed' | 'update_required'
  steps: boolean
  background: boolean
  backgroundSupported?: boolean
  reminder?: boolean
  hour?: number
  minute?: number
  goal?: number
}

export interface DaySteps {
  date: string
  steps: number
}

interface StepsPlugin {
  status(): Promise<StepsStatus>
  requestAccess(): Promise<{ steps: boolean; background: boolean }>
  daily(options: { days: number }): Promise<{ days: DaySteps[] }>
  /** Шаги сегодня по часам: 24 числа, с полуночи. В старых сборках APK метода нет. */
  hourly(): Promise<{ hours: number[] }>
  setReminder(options: {
    enabled: boolean
    hour: number
    minute: number
    goal: number
  }): Promise<{ enabled: boolean }>
  testReminder(): Promise<void>
  openHealthConnect(): Promise<void>
}

/** Запущено ли приложение как Android-версия. */
export const isAndroidApp = () => Capacitor.getPlatform() === 'android'

export const Steps = registerPlugin<StepsPlugin>('Steps')

/** Цель по умолчанию, пока пользователь не задал свою. */
export const DEFAULT_STEPS_GOAL = 8000
