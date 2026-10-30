import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

/**
 * 画面共通の UI プリミティブ。
 * 記法を統一するため、ボタン・カード・入力欄はすべてここを経由します。
 */

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-[#0052cc] text-white hover:bg-[#0065ff] disabled:bg-[#a5adba]',
  secondary: 'bg-white text-[#42526e] border border-[#dfe1e6] hover:bg-[#f4f5f7]',
  danger: 'bg-[#de350b] text-white hover:bg-[#ff5630] disabled:bg-[#a5adba]',
  ghost: 'bg-transparent text-[#0052cc] hover:bg-[#e9f2ff]',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[3px] px-4 py-2.5 text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-70',
        VARIANT_CLASS[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    />
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={[
        'rounded-[3px] border border-[#dfe1e6] bg-white p-4 shadow-[0_1px_1px_rgba(9,30,66,0.15)]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-base font-semibold text-[#172b4d]">{children}</h2>
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-semibold text-[#5e6c84]">{children}</span>
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return (
    <input
      {...rest}
      className={[
        'w-full rounded-[3px] border border-[#dfe1e6] bg-[#fafbfc] px-3 py-2 text-[#172b4d]',
        'focus:border-[#0052cc] focus:bg-white focus:outline-none',
        className,
      ].join(' ')}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props
  return (
    <select
      {...rest}
      className={[
        'w-full rounded-[3px] border border-[#dfe1e6] bg-[#fafbfc] px-3 py-2 text-[#172b4d]',
        'focus:border-[#0052cc] focus:bg-white focus:outline-none',
        className,
      ].join(' ')}
    />
  )
}

type ToneType = 'info' | 'success' | 'warning' | 'error'

const TONE_CLASS: Record<ToneType, string> = {
  info: 'bg-[#deebff] text-[#0747a6] border-[#b3d4ff]',
  success: 'bg-[#e3fcef] text-[#006644] border-[#abf5d1]',
  warning: 'bg-[#fffae6] text-[#974f0c] border-[#ffe380]',
  error: 'bg-[#ffebe6] text-[#bf2600] border-[#ffbdad]',
}

export function Banner({ tone = 'info', children }: { tone?: ToneType; children: ReactNode }) {
  return (
    <div className={['rounded-[3px] border px-3 py-2 text-sm whitespace-pre-wrap', TONE_CLASS[tone]].join(' ')}>
      {children}
    </div>
  )
}

export function Badge({ tone = 'info', children }: { tone?: ToneType; children: ReactNode }) {
  return (
    <span
      className={['inline-block rounded-[3px] border px-2 py-0.5 text-xs font-semibold', TONE_CLASS[tone]].join(
        ' ',
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[3px] border border-dashed border-[#dfe1e6] bg-white px-4 py-8 text-center text-sm text-[#5e6c84]">
      {children}
    </div>
  )
}
