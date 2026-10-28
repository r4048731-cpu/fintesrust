import { useEffect, useRef, useState } from 'react'
import { useRepos } from '../../app/dataContext'
import { isBarcode, lookupBarcode, LookupError } from '../../data/openFoodFacts'
import type { BarcodeFood } from '../../domain/types'
import { createDetector } from '../../native/barcode'
import { Button } from '../Button'
import { TextField } from '../Field'
import styles from './BarcodeScanner.module.css'

/** Как часто искать штрихкод в кадре, мс. */
const SCAN_EVERY_MS = 250

type Camera = 'starting' | 'on' | 'off'

/**
 * Скан штрихкода в листе «Добавить еду»: камера с рамкой и поле для цифр вручную.
 * Найденный продукт запоминается — второй раз он находится без интернета.
 */
export function BarcodeScanner({
  onFound,
  onCancel,
}: {
  onFound: (food: BarcodeFood) => void
  onCancel: () => void
}) {
  const repos = useRepos()
  const video = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<Camera>('starting')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // распознанный код ищется один раз, даже если камера видит его в каждом кадре
  const looking = useRef(false)
  const find = useRef<(code: string) => Promise<void>>(async () => {})

  async function lookup(raw: string) {
    const c = raw.replace(/\D/g, '')
    if (!isBarcode(c)) return setError('Штрихкод — 8 или 12–14 цифр')
    if (looking.current) return
    looking.current = true
    setBusy(true)
    setError(null)
    try {
      const saved = (await repos.meta.get('barcodeFoods'))[c]
      const food = saved ?? (await lookupBarcode(c))
      if (!food) {
        setCode(c)
        return setError(`Продукта ${c} нет в базе — введите КБЖУ с упаковки`)
      }
      if (!saved) {
        const all = await repos.meta.get('barcodeFoods')
        await repos.meta.set('barcodeFoods', { ...all, [c]: food })
      }
      onFound(food)
    } catch (err) {
      setError(err instanceof LookupError ? err.message : 'Не удалось найти продукт')
    } finally {
      looking.current = false
      setBusy(false)
    }
  }
  // кадры камеры обрабатывает эффект — ему нужна свежая lookup
  useEffect(() => {
    find.current = lookup
  })

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let alive = true
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('нет камеры')
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (!alive || !video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const detector = await createDetector()
        if (!alive) return
        setCamera('on')
        const tick = async () => {
          if (!alive || !video.current) return
          try {
            const [hit] = await detector.detect(video.current)
            if (hit?.rawValue && isBarcode(hit.rawValue)) void find.current(hit.rawValue)
          } catch {
            // кадр не готов — следующий
          }
          timer = setTimeout(tick, SCAN_EVERY_MS)
        }
        void tick()
      } catch {
        if (alive) setCamera('off')
      }
    })()
    return () => {
      alive = false
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <section className={styles.scanner} aria-label="Скан штрихкода">
      {camera !== 'off' && (
        <div className={styles.view}>
          <video ref={video} muted playsInline aria-label="Камера" />
          <span className={styles.frame} aria-hidden="true" />
        </div>
      )}
      <p className={styles.status} role="status">
        {busy
          ? 'Ищу продукт…'
          : camera === 'starting'
            ? 'Включаю камеру…'
            : camera === 'on'
              ? 'Наведите камеру на штрихкод'
              : 'Камера недоступна — введите цифры под штрихкодом'}
      </p>
      <div className={styles.manual}>
        <TextField
          label="Цифры штрихкода"
          value={code}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void lookup(code)}
        />
        <Button disabled={busy} onClick={() => void lookup(code)}>
          Найти
        </Button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button variant="ghost" block onClick={onCancel}>
        Ввести вручную
      </Button>
    </section>
  )
}
