import styles from './Skeleton.module.css'

/** Одна карточка-заготовка: заголовок, крупный блок и пара строк. */
export function SkeletonCard({ block = true }: { block?: boolean }) {
  return (
    <div className={styles.card}>
      <span className={`${styles.line} ${styles.title}`} />
      {block && <span className={`${styles.line} ${styles.block}`} />}
      <span className={styles.line} />
      <span className={`${styles.line} ${styles.short}`} />
    </div>
  )
}

/** Мерцающие заготовки карточек, пока грузятся данные, — вместо пустого экрана. */
export function Skeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className={styles.list} aria-hidden="true" data-skeleton>
      {Array.from({ length: cards }, (_, i) => (
        <SkeletonCard key={i} block={i === 0} />
      ))}
    </div>
  )
}
