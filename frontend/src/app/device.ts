// Возможности устройства: защита данных от очистки и установка на главный экран.

/**
 * Просит браузер не удалять данные приложения при нехватке места.
 * Работает только на HTTPS; iOS обычно соглашается, если приложение установлено на главный экран.
 * Возвращает, защищены ли данные сейчас (null — браузер не умеет отвечать).
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null
    if (await navigator.storage.persisted()) return true
    return (await navigator.storage.persist?.()) ?? false
  } catch {
    return null
  }
}

export async function isStoragePersisted(): Promise<boolean | null> {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null
  } catch {
    return null
  }
}

/** Событие Chrome на Android, которое позволяет показать свою кнопку «Установить». */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let installEvent: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

/** Вызывается один раз при запуске, до того как браузер пришлёт событие. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    listeners.forEach((l) => l())
  })
}

export function canPromptInstall(): boolean {
  return installEvent !== null
}

export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false
  await installEvent.prompt()
  const { outcome } = await installEvent.userChoice
  installEvent = null
  listeners.forEach((l) => l())
  return outcome === 'accepted'
}

/** Приложение уже открыто с главного экрана, а не во вкладке браузера. */
export function isInstalled(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Сохраняет файл: на телефоне с HTTPS — через меню «Поделиться» (на iPhone так файл
 * попадает в «Файлы»), иначе — обычной загрузкой. Возвращает false, если пользователь отказался.
 */
export async function saveFile(
  name: string,
  text: string,
  type = 'application/json',
): Promise<boolean> {
  const file = new File([text], name, { type })
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false
      // share недоступен — падаем на обычную загрузку
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}
