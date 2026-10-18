// Поделиться картинкой: в Android-версии — через свой мост (`android/.../share/ShareImagePlugin.kt`),
// в браузере — системным окном navigator.share, а где его нет — скачиванием файла.

import { registerPlugin } from '@capacitor/core'
import { isAndroidApp } from './steps'

interface ShareImagePlugin {
  share(options: { base64: string; fileName: string; title: string }): Promise<void>
}

const ShareImage = registerPlugin<ShareImagePlugin>('ShareImage')

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

export async function shareImage(
  blob: Blob,
  fileName: string,
  title: string,
): Promise<ShareResult> {
  if (isAndroidApp()) {
    await ShareImage.share({ base64: await toBase64(blob), fileName, title })
    return 'shared'
  }
  const file = new File([blob], fileName, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      // закрыл окно «Поделиться» — это не ошибка
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      throw err
    }
  }
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
