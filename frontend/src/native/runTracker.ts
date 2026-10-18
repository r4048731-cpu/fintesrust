// Мост к нативной записи маршрута (только Android-версия, `android/.../run/RunTrackerPlugin.kt`).
// Служба переднего плана пишет точки GPS и при выключенном экране, пока WebView спит;
// экран бега забирает накопленные точки. В браузере — обычный watchPosition.

import { registerPlugin } from '@capacitor/core'
import type { GpsFix } from '../domain/run'

interface RunTrackerPlugin {
  /** Начать запись; спрашивает доступ к геолокации. Ошибка с кодом NO_LOCATION — доступа нет. */
  start(options: { title: string }): Promise<void>
  /** Точки, накопленные с прошлого вызова; включён ли GPS; идёт ли запись. */
  drain(): Promise<{ fixes: GpsFix[]; gpsOn: boolean; running: boolean }>
  /** Остановить запись и забрать оставшиеся точки. */
  stop(): Promise<{ fixes: GpsFix[] }>
}

export const RunTracker = registerPlugin<RunTrackerPlugin>('RunTracker')
