import { Sheet } from './Sheet'
import styles from './AiSheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * ИИ-помощник из центра нижней панели. Пока заглушка «скоро»: чат готов
 * (`components/ai/AiChat.tsx`, бесплатные модели без ключей) — чтобы включить,
 * вместо содержимого шторки поставить `<AiChat />`.
 */
export function AiSheet({ open, onClose }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="ИИ-помощник">
      <div className={styles.soon} role="note" aria-label="ИИ-помощник скоро">
        <span className={styles.badge}>Скоро</span>
        <p>
          В ближайшее время здесь появится ИИ-тренер — чат, который знает ваши тренировки, вес и
          питание и помогает по ним.
        </p>
      </div>
      <h3 className={styles.title}>Что он будет уметь</h3>
      <ul className={styles.list}>
        <li>Разбирать тренировки: где пора прибавить вес, а где дать отдых</li>
        <li>Подсказывать, что съесть, чтобы добрать белок и уложиться в калории</li>
        <li>Составлять программу на неделю под ваши цели и расписание</li>
        <li>Объяснять технику упражнений и отвечать на вопросы о питании</li>
      </ul>
      <p className={styles.muted}>Бесплатно, без регистрации и ключей. Нужен будет интернет.</p>
    </Sheet>
  )
}
