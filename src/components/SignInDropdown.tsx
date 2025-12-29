import type { JSX } from 'solid-js'
import type { Provider } from '~/lib/auth'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { useAuth } from '~/lib/auth'

export function SignInDropdown(props: {
  disabled?: boolean
  wrapperClass?: string
  buttonClass?: string
  label?: string
  onBeforeSignIn?: () => void
  align?: 'left' | 'right'
  buttonContent?: JSX.Element
}) {
  const auth = useAuth()
  const [open, setOpen] = createSignal(false)

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('[data-sign-in-dropdown]'))
      setOpen(false)
  }

  createEffect(() => {
    if (!open())
      return
    const t = setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
    onCleanup(() => {
      clearTimeout(t)
      document.removeEventListener('click', handleClickOutside)
    })
  })

  function signIn(provider: Provider) {
    try {
      props.onBeforeSignIn?.()
    }
    catch {}
    auth.signIn(provider)
    setOpen(false)
  }

  const alignClass = () => (props.align ?? 'right') === 'right' ? 'right-0' : 'left-0'

  return (
    <div class={`relative ${props.wrapperClass ?? ''}`} data-sign-in-dropdown>
      <button
        disabled={props.disabled}
        onClick={() => setOpen(v => !v)}
        class={props.buttonContent
          ? (props.buttonClass ?? undefined)
          : (props.buttonClass
            ?? 'text-sm text-zinc-400 px-3 py-1.5 border border-zinc-700 rounded-lg bg-zinc-800/50 flex gap-2 transition-colors items-center hover:text-emerald-300 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed')}
      >
        <Show
          when={props.buttonContent}
          fallback={(
            <>
              <i class="i-ph:sign-in-bold" />
              {props.label ?? 'Sign In'}
            </>
          )}
        >
          {props.buttonContent}
        </Show>
      </button>

      <Show when={open()}>
        <div class={`mt-2 border border-zinc-700 rounded-lg bg-zinc-900 w-48 shadow-xl absolute z-50 overflow-hidden ${alignClass()}`}>
          <div class="p-2 space-y-1">
            <div class="text-xs text-zinc-500 font-medium px-2 py-1.5">Sign in with</div>
            <button
              onClick={() => signIn('google')}
              class="text-sm text-zinc-300 px-3 py-2 rounded-md flex gap-3 w-full transition-colors items-center hover:text-white hover:bg-zinc-800"
            >
              <i class="i-ph:google-logo text-lg" />
              Google
            </button>
            <button
              onClick={() => signIn('discord')}
              class="text-sm text-zinc-300 px-3 py-2 rounded-md flex gap-3 w-full transition-colors items-center hover:text-white hover:bg-zinc-800"
            >
              <i class="i-ph:discord-logo text-lg" />
              Discord
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}
