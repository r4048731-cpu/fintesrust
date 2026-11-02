import { useId, type ReactNode } from 'react'
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
    <section className={icon ? `${styles.empty} ${styles.withArt}` : styles.empty}>
      {icon && <EmptyArt icon={icon} />}
      <h2 className={styles.title}>{title}</h2>
      {children && <div className={styles.text}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </section>
  )
}

/**
 * Иллюстрация пустого раздела: градиентное пятно, две карточки-подложки,
 * искорки и значок раздела на главной карточке. Рисуется в цветах темы.
 */
function EmptyArt({ icon }: { icon: IconName }) {
  const gid = useId()
  return (
    <div className={styles.art} aria-hidden="true">
      <svg viewBox="0 0 160 112" className={styles.scene}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="0.5" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <ellipse cx="80" cy="60" rx="62" ry="44" fill={`url(#${gid})`} opacity="0.14" />
        <rect
          x="28"
          y="34"
          width="56"
          height="44"
          rx="12"
          className={styles.cardBack}
          transform="rotate(-10 56 56)"
        />
        <rect
          x="76"
          y="34"
          width="56"
          height="44"
          rx="12"
          className={styles.cardBack}
          transform="rotate(10 104 56)"
        />
        <g className={styles.sparks} fill={`url(#${gid})`}>
          <circle cx="22" cy="24" r="3" />
          <circle cx="140" cy="20" r="4" />
          <circle cx="146" cy="88" r="2.5" />
          <path d="M30 92l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          <path d="M124 6l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
        </g>
      </svg>
      <span className={styles.badge}>
        <Icon name={icon} size={30} />
      </span>
    </div>
  )
}
