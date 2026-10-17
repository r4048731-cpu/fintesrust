import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { IconButton } from './Button'
import styles from './Sheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Кнопки внизу шторки, например «Сохранить». */
  footer?: ReactNode
  /** Почти на весь экран и постоянной высоты — не прыгает, когда меняется содержимое. */
  tall?: boolean
}

/** Длительность выезда и ухода шторки, мс. Совпадает с анимацией в CSS. */
const ANIMATION_MS = 220
/** Насколько потянуть вниз, чтобы шторка закрылась, px. */
const CLOSE_DISTANCE = 90
/** Или с какой скоростью смахнуть, px/мс. */
const CLOSE_VELOCITY = 0.6

/** Анимации нет в тестах (там нет matchMedia) и при системной настройке «уменьшить движение». */
function animated(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Нижняя шторка на нативном <dialog>: браузер сам держит фокус внутри,
 * закрывает по Esc и возвращает фокус на кнопку, которая открыла шторку.
 * Выезжает снизу; закрывается крестиком, нажатием на фон или свайпом вниз за шапку.
 */
export function Sheet({ open, onClose, title, children, footer, tall }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [drag, setDrag] = useState(0)
  /** Палец на шапке: пока тянут, шторка едет за пальцем без плавности. */
  const [pressed, setPressed] = useState(false)
  const start = useRef<{ y: number; t: number } | null>(null)

  // Пока шторка уезжает, на ней остаётся прежнее содержимое: родитель к этому моменту
  // обычно уже ничего не передаёт (`{open && <Форма />}`).
  const [prevOpen, setPrevOpen] = useState(open)
  const [closing, setClosing] = useState(false)
  const [kept, setKept] = useState(children)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setClosing(!open && animated())
    if (open) setDrag(0)
  }
  if (open && kept !== children) setKept(children)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      return
    }
    if (!dialog.open) return
    const close = () => {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
    if (!closing) {
      close()
      return
    }
    const timer = setTimeout(() => {
      close()
      setClosing(false)
      setDrag(0)
    }, ANIMATION_MS)
    return () => clearTimeout(timer)
  }, [open, closing])

  function onPointerDown(e: React.PointerEvent) {
    // Кнопку «Закрыть» в шапке не перехватываем
    if ((e.target as HTMLElement).closest('button')) return
    start.current = { y: e.clientY, t: performance.now() }
    setPressed(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return
    setDrag(Math.max(0, e.clientY - start.current.y))
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!start.current) return
    const dy = Math.max(0, e.clientY - start.current.y)
    const velocity = dy / Math.max(1, performance.now() - start.current.t)
    start.current = null
    setPressed(false)
    if (dy > CLOSE_DISTANCE || (dy > 20 && velocity > CLOSE_VELOCITY)) onClose()
    else setDrag(0)
  }

  return (
    <dialog
      ref={ref}
      className={[styles.sheet, tall && styles.tall, closing && styles.closing]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
      style={drag ? { transform: `translateY(${drag}px)` } : undefined}
      data-dragging={pressed || undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // Нажатие на затемнённый фон вокруг шторки приходит на сам <dialog>
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {(open || closing) && (
        <div className={styles.inner}>
          <div
            className={styles.handle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className={styles.grab} aria-hidden="true" />
            <header className={styles.head}>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              <IconButton icon="close" label="Закрыть" onClick={onClose} />
            </header>
          </div>
          <div className={styles.body}>{open ? children : kept}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
