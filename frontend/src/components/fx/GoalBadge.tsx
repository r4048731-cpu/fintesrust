import { Icon } from '../Icon'
import styles from './goal.module.css'

/** Значок «✓ Цель» у выполненной нормы: воды, шагов, калорий. Выскакивает при появлении. */
export function GoalBadge({ children = 'Цель' }: { children?: string }) {
  return (
    <span className={styles.badge}>
      <Icon name="check" size={14} />
      {children}
    </span>
  )
}
