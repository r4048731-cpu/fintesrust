// Уменьшает снимок с камеры или из галереи до JPEG в data URL: оригинал в 4–12 Мп
// занял бы в базе и резервной копии в десятки раз больше места.

/** Длинная сторона снимка и миниатюры, px. */
const IMAGE_SIDE = 1280
const THUMB_SIDE = 360

export interface ResizedPhoto {
  image: string
  thumb: string
}

async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  // createImageBitmap сам поворачивает снимок по EXIF; где его нет — обычный <img>
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // ниже — запасной путь
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function draw(
  src: CanvasImageSource & { width: number; height: number },
  side: number,
  quality: number,
): string {
  const scale = Math.min(1, side / Math.max(src.width, src.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(src.width * scale)
  canvas.height = Math.round(src.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Не удалось обработать фото')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

export async function resizePhoto(file: Blob): Promise<ResizedPhoto> {
  let src
  try {
    src = await decode(file)
  } catch {
    throw new Error('Не удалось открыть фото — выберите снимок в формате JPEG или PNG')
  }
  return { image: draw(src, IMAGE_SIDE, 0.82), thumb: draw(src, THUMB_SIDE, 0.75) }
}
