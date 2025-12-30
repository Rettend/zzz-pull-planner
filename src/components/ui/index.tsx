import type { JSX } from 'solid-js'
import type { PlannerSettings } from '~/lib/planner'
import { createMemo, For } from 'solid-js'

function pct(n: number, d: number): string {
  if (d <= 0)
    return '0%'
  return `${Math.max(0, Math.min(100, (n / d) * 100)).toFixed(2)}%`
}

export function Badge(props: { ok?: boolean, label: string, title?: string }) {
  return (
    <span
      class={`text-xs px-2 py-0.5 border rounded inline-flex gap-2 items-center ${props.ok === false
        ? 'text-red-300 border-red-500/60 bg-red-500/10'
        : props.ok ? 'text-emerald-300 border-emerald-500/60 bg-emerald-500/10' : 'text-zinc-300 border-zinc-600 bg-zinc-700/30'}`}
      title={props.title}
    >
      <i class={`size-4 ${props.ok === false ? 'i-ph:warning-circle-duotone' : props.ok ? 'i-ph:check-circle-duotone' : 'i-ph:info-duotone'}`} />
      {props.label}
    </span>
  )
}

export function BudgetBar(props: {
  total: number
  segments: { value: number, color: string, label: string, title?: string }[]
}) {
  const visible = createMemo(() => props.segments.filter(s => s.value > 0))

  return (
    <div class="space-y-1">
      <div class="border border-zinc-700 rounded bg-zinc-800 flex h-3 w-full overflow-hidden">
        <For each={visible()}>
          {(s, i) => (
            <div
              class={`${s.color}  ${i() > 0 ? 'border-l border-black/40' : ''}  ${i() < visible().length - 1 ? 'border-r border-black/40' : ''} box-border`}
              style={{ width: pct(s.value, props.total) }}
              title={`${s.label}: ${Math.round(s.value)}${props.total ? ` (${pct(s.value, props.total)})` : ''}`}
            />
          )}
        </For>
      </div>
      <div class="text-xs text-zinc-400 flex flex-wrap gap-2">
        <For each={props.segments}>
          {s => (
            <span class="inline-flex gap-1 items-center" title={s.title}>
              <span class={`rounded h-2 w-2 inline-block ${s.color.replace('h-3 ', '').replace('w-full ', '')}`} />
              {s.label}
            </span>
          )}
        </For>
      </div>
    </div>
  )
}

export function NumberField(props: {
  label: string
  label2?: string
  min?: number
  max?: number
  step?: number
  value: string
  onInput: (e: InputEvent & { currentTarget: HTMLInputElement }) => void
}) {
  return (
    <label class="group p-3 border border-zinc-800 rounded-lg bg-zinc-900/50 flex gap-3 cursor-pointer transition-colors items-center hover:bg-zinc-800/10">
      <input
        class="px-2 py-1.5 text-center border border-zinc-700 rounded-md bg-zinc-900 w-16 tabular-nums"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={props.value}
        onInput={e => props.onInput(e)}
      />
      <span class="text-xs text-zinc-400 transition-colors group-hover:text-zinc-300">
        <span>{props.label}</span>
        {props.label2 && (
          <span class="whitespace-nowrap">
            {' '}
            {props.label2}
          </span>
        )}
      </span>
    </label>
  )
}

export function StatRow(props: {
  label: string
  value?: JSX.Element | string | number
  badge?: { ok?: boolean, label: string }
  title?: string
  trailing?: JSX.Element
  explain?: JSX.Element | string
  valueOk?: boolean
}) {
  return (
    <li title={props.title} class="p-2 border-b border-zinc-800/50 gap-x-3 gap-y-1 grid grid-cols-[1fr_auto] md:p-0 last:border-0 md:border-0 md:contents">
      <div class="text-zinc-300 flex gap-2 items-center">
        {props.label}
        {props.trailing}
      </div>
      <div class="text-right whitespace-nowrap">
        {props.value !== undefined
          ? (
              <span class={`${props.valueOk === false ? 'text-red-300' : 'text-emerald-300'}`}>{typeof props.value === 'number' ? Math.round(props.value) : props.value}</span>
            )
          : null}
      </div>
      <div class="flex gap-2 col-span-2 items-center md:col-span-1">
        {props.badge
          ? (
              <Badge ok={props.badge.ok} label={props.badge.label} />
            )
          : null}
      </div>
      <div class="text-xs text-zinc-400 col-span-2 md:col-span-1">
        {props.explain}
      </div>
    </li>
  )
}

export type NumberKeys = {
  [K in keyof PlannerSettings]-?: PlannerSettings[K] extends number | undefined ? K : never
}[keyof PlannerSettings]

export type BoolKeys = {
  [K in keyof PlannerSettings]-?: PlannerSettings[K] extends boolean | undefined ? K : never
}[keyof PlannerSettings]

/**
 * Sanitizes a number input, enforcing min/max and handling empty values.
 * Returns the sanitized number value.
 */
export function sanitizeNumberInput(
  e: InputEvent & { currentTarget: HTMLInputElement },
  options?: { min?: number, max?: number },
): number {
  const raw = e.currentTarget.value
  const digitsOnly = raw.replace(/\D/g, '')

  // If user deleted everything, treat as 0 (or min if set)
  if (digitsOnly === '') {
    const minVal = options?.min !== undefined ? Math.max(0, options.min) : 0
    e.currentTarget.value = String(minVal)
    return minVal
  }

  let n = Number(digitsOnly)
  if (options?.min !== undefined)
    n = Math.max(options.min, n)
  if (options?.max !== undefined)
    n = Math.min(options.max, n)

  // Update displayed value to match clamped value
  e.currentTarget.value = String(n)
  return n
}

export function numberInput<K extends NumberKeys & keyof PlannerSettings>(
  inputs: () => PlannerSettings,
  setPlannerInput: (key: K, value: PlannerSettings[K]) => void,
  key: K,
  options?: { min?: number, max?: number },
) {
  return {
    value: String(inputs()[key] ?? 0),
    onInput: (e: InputEvent & { currentTarget: HTMLInputElement }) => {
      const n = sanitizeNumberInput(e, options)
      setPlannerInput(key, n)
    },
  }
}

export function boolInput<K extends BoolKeys & keyof PlannerSettings>(
  inputs: () => PlannerSettings,
  setPlannerInput: (key: K, value: PlannerSettings[K]) => void,
  key: K,
) {
  return {
    checked: Boolean(inputs()[key]),
    onChange: (checked: boolean) => {
      setPlannerInput(key, checked)
    },
  }
}
