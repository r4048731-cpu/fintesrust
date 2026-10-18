import type { ReactNode } from 'react'
import { Icon } from './Icon'
import frame from './frame.module.css'
import styles from './LiveCard.module.css'

interface Props {
  /** Что слева: кольцо прогресса или значок. */
  lead: ReactNode
  /** Мелкая подпись с мигающей точкой: «Тренировка идёт». */
  label: string
  title: string
  meta: ReactNode
  onClick: () => void
}

/** Карточка того, что идёт прямо сейчас (тренировка, пробежка): нажатие возвращает к ней. */
export function LiveCard({ lead, label, title, meta, onClick }: Props) {
  return (
    <button type="button" className={`${styles.card} ${frame.frame}`} onClick={onClick}>
      {lead}
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
      <span className={styles.go} aria-hidden="true">
        <Icon name="chevron" size={18} />
      </span>
    </button>
  )
}

/** Значок слева на градиенте — для карточек без кольца прогресса. */
export function LiveIcon({ children }: { children: ReactNode }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      {children}
    </span>
  )
}
