import { BOTS } from '../app/bots'
import styles from './BotLinks.module.css'

/**
 * Переход в Telegram- и MAX-ботов. Пока у бота нет ссылки, кнопка неактивна с пометкой «Скоро».
 * `text` — зачем нужны боты в этом месте приложения.
 */
export function BotLinks({ title = 'Боты', text }: { title?: string; text: string }) {
  const soon = BOTS.every((b) => !b.url)
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {soon && <span className={styles.badge}>Скоро</span>}
      </div>
      <p className={styles.text}>{text}</p>
      <div className={styles.buttons}>
        {BOTS.map((b) =>
          b.url ? (
            <a
              key={b.id}
              className={`${styles.bot} ${styles[b.id]}`}
              href={b.url}
              target="_blank"
              rel="noreferrer"
            >
              {b.name}
            </a>
          ) : (
            <button
              key={b.id}
              type="button"
              className={`${styles.bot} ${styles[b.id]}`}
              disabled
              aria-label={`${b.name} — скоро`}
            >
              {b.name}
            </button>
          ),
        )}
      </div>
    </section>
  )
}
