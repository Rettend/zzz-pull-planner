import type { JSX } from 'solid-js'
import { createMemo, splitProps } from 'solid-js'

export type ButtonVariant = 'gray' | 'green' | 'darkGreen' | 'blue' | 'red'

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: JSX.Element
}

const variantStyles: Record<ButtonVariant, { base: string, hover: string }> = {
  gray: {
    base: 'border-zinc-700 bg-zinc-900',
    hover: 'hover:bg-zinc-800',
  },
  green: {
    base: 'border-emerald-500 bg-emerald-600/30 text-emerald-300',
    hover: 'hover:bg-emerald-600/40',
  },
  darkGreen: {
    base: 'border-emerald-800 bg-emerald-900/40 text-emerald-300',
    hover: 'hover:bg-emerald-900/50',
  },
  blue: {
    base: 'border-sky-600 bg-sky-600/30 text-sky-300',
    hover: 'hover:bg-sky-600/40',
  },
  red: {
    base: 'border-red-600 bg-red-600/30 text-red-300',
    hover: 'hover:bg-red-600/40',
  },
}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, ['variant', 'children', 'class'])
  const variant = createMemo(() => local.variant ?? 'gray')

  return (
    <button
      class={`px-3 py-1.5 border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant()].base}  ${variantStyles[variant()].hover}  ${local.class ?? ''}`}
      {...others}
    >
      {local.children}
    </button>
  )
}
