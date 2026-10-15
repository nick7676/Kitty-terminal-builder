import type { ButtonHTMLAttributes } from 'react'

type Variant = 'default' | 'primary' | 'danger'
type Size = 'md' | 'sm'

export function buttonClass(variant: Variant = 'default', size: Size = 'md', className = '') {
  return ['btn', variant === 'primary' ? 'primary' : '', variant === 'danger' ? 'danger' : '', size === 'sm' ? 'small' : '', className].filter(Boolean).join(' ')
}

export function Button({ variant = 'default', size = 'md', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}
