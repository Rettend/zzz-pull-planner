import type { ParentProps } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'

export function ClientOnly(props: ParentProps<{ fallback?: any }>) {
  const [mounted, setMounted] = createSignal(false)
  onMount(() => setMounted(true))
  return (
    <Show when={mounted()} fallback={props.fallback}>
      {props.children}
    </Show>
  )
}
