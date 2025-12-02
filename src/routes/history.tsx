import type { ParentProps } from 'solid-js'
import { A } from '@solidjs/router'
import { For } from 'solid-js'

const TABS = [
  { href: '/history/exclusive', label: 'Exclusive Channel' },
  { href: '/history/w-engine', label: 'W-Engine Channel' },
  { href: '/history/standard', label: 'Standard Channel' },
  { href: '/history/bangboo', label: 'Bangboo Channel' },
]

export default function HistoryLayout(props: ParentProps) {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl text-white font-bold">Pull History</h1>
        <button
          class="text-sm text-white font-medium px-4 py-2 rounded-lg bg-emerald-600 transition-colors hover:bg-emerald-500"
          // eslint-disable-next-line no-console
          onClick={() => console.log('Import feature coming soon!')}
        >
          Import Data
        </button>
      </div>

      <div class="border-b border-zinc-800">
        <nav class="flex gap-6 overflow-x-auto -mb-px" aria-label="Tabs">
          <For each={TABS}>
            {tab => (
              <A
                href={tab.href}
                class="text-sm font-medium px-1 py-4 border-b-2 whitespace-nowrap transition-colors"
                activeClass="border-emerald-500 text-emerald-400"
                inactiveClass="border-transparent text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              >
                {tab.label}
              </A>
            )}
          </For>
        </nav>
      </div>

      <div class="min-h-[500px]">
        {props.children}
      </div>
    </div>
  )
}
