import type { JSX } from 'solid-js'
import { createEffect, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'

export interface ModalProps {
  open: boolean
  title?: JSX.Element
  onClose: () => void
  children: JSX.Element
  maxWidthClass?: string
  class?: string
  lockScroll?: boolean
}

export function Modal(props: ModalProps) {
  const lockScroll = () => props.lockScroll ?? true

  createEffect(() => {
    if (!props.open)
      return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape')
        props.onClose()
    }

    document.addEventListener('keydown', onKeyDown)

    const prevOverflow = document.body.style.overflow
    if (lockScroll())
      document.body.style.overflow = 'hidden'

    onCleanup(() => {
      document.removeEventListener('keydown', onKeyDown)
      if (lockScroll())
        document.body.style.overflow = prevOverflow
    })
  })

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="p-0 bg-black/80 flex items-center inset-0 justify-center fixed z-50 backdrop-blur-sm md:p-4"
          onClick={() => props.onClose()}
        >
          <div
            class={`border-zinc-700 rounded-none bg-zinc-900 flex flex-col h-full max-h-full w-full shadow-2xl overflow-hidden md:border md:rounded-xl lg:h-auto md:max-h-[90vh] ${props.maxWidthClass ?? 'md:max-w-lg'}  ${props.class ?? ''}`}
            onClick={e => e.stopPropagation()}
          >
            <Show when={props.title}>
              <div class="p-4 bg-zinc-950/50 flex shrink-0 items-center justify-between">
                <h3 class="text-lg text-white font-bold flex gap-2 items-center">
                  {props.title}
                </h3>
                <button
                  onClick={() => props.onClose()}
                  class="text-zinc-400 p-1 rounded-md transition-colors hover:text-white hover:bg-zinc-800"
                  aria-label="Close modal"
                >
                  <i class="i-ph:x-bold size-5" />
                </button>
              </div>
            </Show>

            {props.children}
          </div>
        </div>
      </Portal>
    </Show>
  )
}
