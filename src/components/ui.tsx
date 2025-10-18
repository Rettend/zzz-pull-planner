import type { JSX } from 'solid-js'
import type { PlannerInputs } from '~/lib/planner'
import { For } from 'solid-js'

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
  return (
    <div class="space-y-1">
      <div class="border border-zinc-700 rounded bg-zinc-800 flex h-3 w-full overflow-hidden">
        <For each={props.segments.filter(s => s.value > 0)}>
          {s => (
            <div
              class={s.color}
              style={{ width: pct(s.value, props.total) }}
              title={`${s.label}: ${s.value}${props.total ? ` (${pct(s.value, props.total)})` : ''}`}
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
  min?: number
  max?: number
  step?: number
  value: string
  onInput: (e: InputEvent & { currentTarget: HTMLInputElement }) => void
}) {
  return (
    <label class="space-y-1">
      <div class="text-xs text-zinc-400">{props.label}</div>
      <input
        class="px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 w-full"
        type="number"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={e => props.onInput(e)}
      />
    </label>
  )
}

export function CheckboxField(props: {
  label: string
  checked: boolean
  onChange: (e: Event & { currentTarget: HTMLInputElement }) => void
}) {
  return (
    <label class="flex gap-2 items-end">
      <input type="checkbox" class="accent-emerald-400" checked={props.checked} onChange={e => props.onChange(e)} />
      <span class="text-xs text-zinc-400">{props.label}</span>
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
}) {
  return (
    <li title={props.title} class="contents">
      <div class="text-zinc-300 flex gap-2 items-center">
        {props.label}
        {props.trailing}
      </div>
      <div class="text-right whitespace-nowrap">
        {props.value !== undefined
          ? (
              <span class="text-emerald-300">{props.value}</span>
            )
          : null}
      </div>
      <div class="flex gap-2 items-center">
        {props.badge
          ? (
              <Badge ok={props.badge.ok} label={props.badge.label} />
            )
          : null}
      </div>
      <div class="text-xs text-zinc-400">
        {props.explain}
      </div>
    </li>
  )
}

export type NumberKeys = {
  [K in keyof PlannerInputs]: PlannerInputs[K] extends number ? K : never
}[keyof PlannerInputs]

export type BoolKeys = {
  [K in keyof PlannerInputs]: PlannerInputs[K] extends boolean ? K : never
}[keyof PlannerInputs]

export function numberInput<K extends NumberKeys>(
  inputs: () => PlannerInputs,
  setPlannerInput: (key: K, value: PlannerInputs[K]) => void,
  key: K,
) {
  return {
    value: String(inputs()[key] ?? ''),
    onInput: (e: InputEvent & { currentTarget: HTMLInputElement }) => {
      const v = e.currentTarget.value.trim()
      const n = v === '' ? 0 : Number(v)
      setPlannerInput(key, Number.isFinite(n) ? n : 0)
    },
  }
}

export function boolInput<K extends BoolKeys>(
  inputs: () => PlannerInputs,
  setPlannerInput: (key: K, value: PlannerInputs[K]) => void,
  key: K,
) {
  return {
    checked: Boolean(inputs()[key]),
    onChange: (e: Event & { currentTarget: HTMLInputElement }) => {
      setPlannerInput(key, e.currentTarget.checked)
    },
  }
}
