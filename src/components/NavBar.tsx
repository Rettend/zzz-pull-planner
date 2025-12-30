import { A, useLocation } from '@solidjs/router'
import { For } from 'solid-js'

const NAV_ITEMS: { href: string, label: string; disabled?: boolean }[] = [
  { href: '/', label: 'Home' },
  { href: '/guide', label: 'Guide' },
  { href: '/history', label: 'History' },
  { href: '/about', label: 'About' },
]

export function NavBar() {
  const location = useLocation()

  return (
    <nav class="flex flex-col gap-2 items-end sm:flex-row sm:gap-6 sm:items-center">
      <For each={NAV_ITEMS}>
        {item => (
          item.disabled
            ? (
                <span class="text-sm text-zinc-600 cursor-default select-none" title="Coming Soon">
                  {item.label}
                </span>
              )
            : (
                <A
                  href={item.href}
                  end={item.href === '/'}
                  class="text-sm transition-colors hover:text-emerald-300"
                  classList={{
                    'text-emerald-400 font-medium': location.pathname === item.href,
                    'text-zinc-400': location.pathname !== item.href,
                  }}
                >
                  {item.label}
                </A>
              )
        )}
      </For>
    </nav>
  )
}
