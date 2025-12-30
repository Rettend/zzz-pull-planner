import type { ParentProps } from 'solid-js'
import { A } from '@solidjs/router'
import { createSignal, For, Show } from 'solid-js'
import { ImportHistoryModal } from '~/components/ImportHistoryModal'
import { Button } from '~/components/ui/button'
import { usePullHistory } from '~/stores/pullHistory'

const TABS = [
  { href: '/history/exclusive', label: 'Exclusive Channel' },
  { href: '/history/w-engine', label: 'W-Engine Channel' },
  { href: '/history/standard', label: 'Standard Channel' },
  { href: '/history/bangboo', label: 'Bangboo Channel' },
]

export default function HistoryLayout(props: ParentProps) {
  const [importModalOpen, setImportModalOpen] = createSignal(false)
  const pullHistory = usePullHistory()

  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex gap-3 items-center">
          <h1 class="text-2xl text-white font-bold">Pull History</h1>
          <Show when={pullHistory.hasData()}>
            <span class="text-xs text-emerald-400 font-medium px-2 py-1 rounded-full bg-emerald-500/20">
              <i class="i-ph:check-bold mr-1" />
              Imported
            </span>
          </Show>
        </div>
        <div class="flex gap-2">
          <Show when={pullHistory.hasData()}>
            <Button onClick={() => pullHistory.clearData()}>
              <i class="i-ph:trash-bold mr-1" />
              Clear Data
            </Button>
          </Show>
          <Button variant="green" onClick={() => setImportModalOpen(true)}>
            <i class="i-ph:download-simple-bold mr-1" />
            {pullHistory.hasData() ? 'Re-import' : 'Import Data'}
          </Button>
        </div>
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

      <ImportHistoryModal
        open={importModalOpen()}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  )
}
