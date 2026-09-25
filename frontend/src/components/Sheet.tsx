import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'
import styles from './Sheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Кнопки внизу шторки, например «Сохранить». */
  footer?: ReactNode
}

/**
 * Нижняя шторка на нативном <dialog>: браузер сам держит фокус внутри,
 * закрывает по Esc и возвращает фокус на кнопку, которая открыла шторку.
 */
export function Sheet({ open, onClose, title, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // Нажатие на затемнённый фон вокруг шторки приходит на сам <dialog>
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {open && (
        <div className={styles.inner}>
          <div className={styles.grab} aria-hidden="true" />
          <header className={styles.head}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <IconButton icon="close" label="Закрыть" onClick={onClose} />
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
