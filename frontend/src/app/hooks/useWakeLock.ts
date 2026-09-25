import { useEffect } from 'react'

/**
 * Не даёт экрану погаснуть, пока идёт тренировка (ТЗ, раздел 5).
 * Браузер снимает блокировку, когда вкладка скрыта, поэтому при возврате она запрашивается снова.
 * Где Wake Lock API нет (старые iOS), просто ничего не происходит.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) void l.release()
        else lock = l
      } catch {
        // отказ браузера (энергосбережение) — работаем без блокировки
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
