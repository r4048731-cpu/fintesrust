import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './EmptyState.module.css'

interface Props {
  title: string
  /** Значок в цветном кружке над заголовком. */
  icon?: IconName
  children?: ReactNode
  /** Главное действие, например кнопка «Создать программу». */
  action?: ReactNode
}

/** Пустой экран или раздел: объясняет, что здесь появится и что сделать первым. */
export function EmptyState({ title, icon, children, action }: Props) {
  return (
    <section className={styles.empty}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
      )}
      <h2 className={styles.title}>{title}</h2>
      {children && <div className={styles.text}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </section>
  )
}
