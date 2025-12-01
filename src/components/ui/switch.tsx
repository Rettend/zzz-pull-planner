import type { JSX } from 'solid-js'
import { splitProps } from 'solid-js'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  class?: string
}

export function Switch(props: SwitchProps) {
  const [local] = splitProps(props, ['checked', 'onChange', 'disabled', 'class'])

  return (
    <button
      type="button"
      role="switch"
      aria-checked={local.checked}
      disabled={local.disabled}
      onClick={() => !local.disabled && local.onChange(!local.checked)}
      class={`border rounded inline-flex shrink-0 h-5 w-9 cursor-pointer transition-colors items-center relative disabled:opacity-50 disabled:cursor-not-allowed ${local.checked ? 'border-emerald-500 bg-emerald-600/30' : 'border-zinc-700 bg-zinc-900 hover:bg-zinc-800'}  ${local.class ?? ''}`}
    >
      <span
        class={`rounded-2px h-3 w-3 inline-block pointer-events-none shadow-sm transition-transform ${local.checked ? 'translate-x-4.5 bg-emerald-400' : 'translate-x-1 bg-zinc-500'}`}
      />
    </button>
  )
}

export interface SwitchFieldProps extends SwitchProps {
  label: string
  description?: string | JSX.Element
}

export function SwitchField(props: SwitchFieldProps) {
  const [local, switchProps] = splitProps(props, ['label', 'description'])

  return (
    <label class="group flex gap-2 cursor-pointer items-center">
      <Switch {...switchProps} />
      <div class="flex flex-col">
        <span class="text-xs text-zinc-400 transition-colors group-hover:text-zinc-300">
          {local.label}
        </span>
        {local.description && (
          <span class="text-xs text-zinc-500">{local.description}</span>
        )}
      </div>
    </label>
  )
}

export interface SwitchCardProps extends SwitchFieldProps {}

export function SwitchCard(props: SwitchCardProps) {
  const [local, switchProps] = splitProps(props, ['label', 'description'])

  return (
    <label class="group p-3 border border-zinc-800 rounded-lg bg-zinc-900/50 flex gap-3 cursor-pointer transition-colors items-center hover:bg-zinc-800/10">
      <Switch {...switchProps} />
      <div class="text-left flex flex-col">
        <span class="text-xs text-zinc-400 transition-colors group-hover:text-zinc-300">
          {local.label}
        </span>
        {local.description && (
          <span class="text-[11px] text-zinc-500">{local.description}</span>
        )}
      </div>
    </label>
  )
}
