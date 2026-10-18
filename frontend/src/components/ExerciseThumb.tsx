import type { ReactNode } from 'react'
import { techniqueImages } from '../domain/technique'
import type { Exercise } from '../domain/types'
import styles from './ExerciseThumb.module.css'

interface Props {
  exercise: Pick<Exercise, 'id' | 'name'>
  /** Метка в углу: номер в плане или галочка. */
  mark?: ReactNode
  /** Цвет метки: текущее упражнение — градиент, сделанное — зелёный. */
  tone?: 'current' | 'done'
}

/** Миниатюра техники упражнения: конечное положение с рисунка или фото; без картинки — первая буква. */
export function ExerciseThumb({ exercise, mark, tone }: Props) {
  const images = techniqueImages(exercise)
  return (
    // номер в плане читается вместе с названием; сама картинка — украшение
    <span className={styles.thumb} aria-hidden={mark === undefined || undefined}>
      <span className={styles.frame} data-kind={images?.kind}>
        {images ? (
          <img
            src={images.frames[images.frames.length - 1]}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className={styles.letter} aria-hidden="true">
            {exercise.name.slice(0, 1)}
          </span>
        )}
      </span>
      {mark !== undefined && (
        <span className={`${styles.mark} ${tone ? styles[tone] : ''}`}>{mark}</span>
      )}
    </span>
  )
}
