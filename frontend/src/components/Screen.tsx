import type { ReactNode } from 'react'
import styles from './Screen.module.css'

interface Props {
  title: string
  /** Мелкая строка над заголовком, например дата. */
  eyebrow?: string
  /** Кнопка справа от заголовка. */
  action?: ReactNode
  children: ReactNode
}

/** Экран вкладки: заголовок и колонка содержимого с одинаковыми отступами. */
export function Screen({ title, eyebrow, action, children }: Props) {
  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <div className={styles.titles}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.title}>{title}</h1>
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

/** Карточка-блок на поверхности. */
export function Card({ children }: { children: ReactNode }) {
  return <section className={styles.card}>{children}</section>
}
