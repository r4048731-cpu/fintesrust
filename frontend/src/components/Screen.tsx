import { useEffect, useState, type ReactNode } from 'react'
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
  /** Шапка над заголовком — на «Сегодня» это полоса с историями. */
  top?: ReactNode
  children: ReactNode
}

/** Прокрутка, после которой большой заголовок сжимается, px. */
const SHRINK_AFTER_PX = 16

/** Прокручена ли страница вниз; состояние меняется только при переходе через порог. */
function useScrolled(enabled: boolean): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const onScroll = () => setScrolled(window.scrollY > SHRINK_AFTER_PX)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enabled])
  return enabled && scrolled
}

/**
 * Экран вкладки: заголовок и колонка содержимого с одинаковыми отступами.
 * Большой заголовок при прокрутке сжимается и остаётся в закреплённой шапке.
 */
export function Screen({ title, eyebrow, action, onBack, top, children }: Props) {
  const scrolled = useScrolled(!top && !onBack)
  return (
    <div className={styles.screen}>
      {top}
      {/* Шапка раздела закреплена сверху; если над ней своя шапка (top) — обычная */}
      <header
        className={top ? `${styles.head} ${styles.plain}` : styles.head}
        data-scrolled={scrolled || undefined}
      >
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

/** Переключатель разделов под шапкой экрана: закреплён сразу под ней и не уходит при прокрутке. */
export function PinnedBar({ children }: { children: ReactNode }) {
  return <div className={styles.pinned}>{children}</div>
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
