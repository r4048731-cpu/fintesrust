// Мост к нативной записи маршрута (только Android-версия, `android/.../run/RunTrackerPlugin.kt`).
// Служба переднего плана пишет точки GPS и при выключенном экране, пока WebView спит;
// экран бега забирает накопленные точки. В браузере — обычный watchPosition.

import { registerPlugin } from '@capacitor/core'
import type { GpsFix } from '../domain/run'

interface RunTrackerPlugin {
  /**
   * Начать запись; спрашивает доступ к геолокации. Ошибка с кодом NO_LOCATION — доступа нет.
   * Повторный вызов во время записи заменяет сигналы `cues`.
   */
  start(options: { title: string; cues?: RunCue[] }): Promise<void>
  /** Точки, накопленные с прошлого вызова; включён ли GPS; идёт ли запись. */
  drain(): Promise<{ fixes: GpsFix[]; gpsOn: boolean; running: boolean }>
  /** Остановить запись и забрать оставшиеся точки. */
  stop(): Promise<{ fixes: GpsFix[] }>
}

/** Сигнал интервалов, который служба подаст сама: время (мс эпохи), фраза голосом и вибрация. */
export interface RunCue {
  at: number
  /** Пусто — голос выключен, только вибрация. */
  text: string
  pattern: number[]
}

export const RunTracker = registerPlugin<RunTrackerPlugin>('RunTracker')
