import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import styles from './Field.module.css'

interface FieldProps {
  label: string
  /** Текст ошибки под полем. */
  error?: string | null
  hint?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Подпись, поле и сообщение об ошибке, связанные для экранного диктора. */
function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id, error || hint ? msgId : undefined)}
      {error ? (
        <p id={msgId} className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={msgId} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  error?: string | null
  hint?: string
}

export function TextField({ label, error, hint, className, ...rest }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <input
          id={id}
          className={[styles.control, className].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </Field>
  )
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string
  options: { value: string; label: string }[]
}

export function SelectField({ label, options, className, ...rest }: SelectFieldProps) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className={[styles.control, className].filter(Boolean).join(' ')} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string
}

export function TextAreaField({ label, className, ...rest }: TextAreaFieldProps) {
  return (
    <Field label={label}>
      {(id) => (
        <textarea
          id={id}
          className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')}
          {...rest}
        />
      )}
    </Field>
  )
}

interface ChipsProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** Ряд переключателей-«таблеток», прокручивается вбок, если не помещается. */
export function Chips<T extends string>({ label, options, value, onChange }: ChipsProps<T>) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.chip}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
