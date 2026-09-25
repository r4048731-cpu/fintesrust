import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'sm'
  block?: boolean
  icon?: IconName
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: Props) {
  const cls = [
    styles.button,
    styles[variant],
    size === 'sm' && styles.sm,
    block && styles.block,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {children}
    </button>
  )
}

interface IconButtonProps extends Omit<Props, 'children' | 'icon' | 'block'> {
  icon: IconName
  /** Подпись для экранного диктора: у кнопки нет видимого текста. */
  label: string
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      icon={icon}
      aria-label={label}
      title={label}
      className={[styles.iconOnly, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
