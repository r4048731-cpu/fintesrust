import type { ReactNode } from 'react'
import { IconButton } from './Button'
import frame from './frame.module.css'
import styles from './Screen.module.css'

interface Props {
  title: string
  /** Мелкая строка над заголовком, например дата. */
  eyebrow?: string
  /** Кнопка справа от заголовка. */
  action?: ReactNode
  /** Кнопка «Назад» слева от заголовка, для вложенных экранов. */
  onBack?: () => void
  children: ReactNode
}

/** Экран вкладки: заголовок и колонка содержимого с одинаковыми отступами. */
export function Screen({ title, eyebrow, action, onBack, children }: Props) {
  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        {onBack && (
          <IconButton icon="back" label="Назад" onClick={onBack} className={styles.back} />
        )}
        <div className={styles.titles}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          {/* У вложенных экранов заголовок меньше и в одну строку: длинный — с многоточием */}
          <h1
            className={onBack ? `${styles.title} ${styles.nested}` : styles.title}
            title={onBack ? title : undefined}
          >
            {title}
          </h1>
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

/** Подпись раздела внутри экрана. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className={styles.label}>{children}</h2>
}

/** Карточка-блок на поверхности; `framed` — градиентная рамка у главной карточки экрана. */
export function Card({
  children,
  className,
  framed,
}: {
  children: ReactNode
  className?: string
  framed?: boolean
}) {
  return (
    <section className={[styles.card, framed && frame.frame, className].filter(Boolean).join(' ')}>
      {children}
    </section>
  )
}
