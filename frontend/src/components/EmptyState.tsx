import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface Props {
  title: string
  children?: ReactNode
  /** Главное действие, например кнопка «Создать программу». */
  action?: ReactNode
}

/** Пустой экран или раздел: объясняет, что здесь появится и что сделать первым. */
export function EmptyState({ title, children, action }: Props) {
  return (
    <section className={styles.empty}>
      <h2 className={styles.title}>{title}</h2>
      {children && <div className={styles.text}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </section>
  )
}
