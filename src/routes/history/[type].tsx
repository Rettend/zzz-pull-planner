import type { GachaTypeName, PullRecord } from '~/stores/pullHistory'
import { useParams } from '@solidjs/router'
import { createMemo, For, Show } from 'solid-js'
import { usePullHistory } from '~/stores/pullHistory'

const TYPE_TO_CHANNEL: Record<string, GachaTypeName> = {
  'standard': 'standard',
  'exclusive': 'exclusive',
  'w-engine': 'w-engine',
  'bangboo': 'bangboo',
}

const RANK_COLORS: Record<string, string> = {
  3: 'text-purple-400',
  4: 'font-bold text-amber-400',
}

const RANK_BG: Record<string, string> = {
  3: 'bg-purple-400/10',
  4: 'bg-amber-400/10',
}

export default function HistoryList() {
  const params = useParams()
  const pullHistory = usePullHistory()

  const channelName = createMemo(() => {
    const type = params.type
    if (!type)
      return null
    return TYPE_TO_CHANNEL[type] || null
  })

  const data = createMemo((): PullRecord[] => {
    const channel = channelName()
    if (!channel)
      return []
    return pullHistory.getChannelData(channel)
  })

  const hasImportedData = () => pullHistory.hasData()

  return (
    <div class="flex flex-col gap-4">
      <Show
        when={hasImportedData()}
        fallback={(
          <div class="px-8 py-16 border border-zinc-800 rounded-lg bg-zinc-900/50 flex flex-col gap-4 items-center justify-center">
            <div class="rounded-full bg-zinc-800 flex size-16 items-center justify-center">
              <i class="i-ph:cloud-arrow-down-bold text-zinc-400 size-8" />
            </div>
            <div class="text-center">
              <h3 class="text-lg text-white font-semibold mb-2">No Data Imported</h3>
              <p class="text-sm text-zinc-400 max-w-md">
                Click the "Import Data" button above to import your pull history from the game.
                You'll need to run a PowerShell script to get your Search History URL.
              </p>
            </div>
          </div>
        )}
      >
        <div class="border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
          <table class="text-sm text-left w-full">
            <thead class="text-zinc-400 bg-zinc-900/80">
              <tr>
                <th class="font-medium px-4 py-3">Time</th>
                <th class="font-medium px-4 py-3">Name</th>
                <th class="font-medium px-4 py-3">Type</th>
                <th class="font-medium px-4 py-3">Rank</th>
              </tr>
            </thead>
            <tbody class="divide-zinc-800 divide-y">
              <For
                each={data()}
                fallback={(
                  <tr>
                    <td colspan="4" class="text-zinc-500 px-4 py-8 text-center">
                      No records found for this channel.
                    </td>
                  </tr>
                )}
              >
                {item => (
                  <tr class="transition-colors hover:bg-zinc-800/50">
                    <td class="text-xs text-zinc-400 font-mono px-4 py-3 whitespace-nowrap">
                      {item.time}
                    </td>
                    <td class="px-4 py-3">
                      <span class={`px-2 py-0.5 rounded ${RANK_BG[item.rank_type] || ''}  ${RANK_COLORS[item.rank_type] || 'text-zinc-300'}`}>
                        {item.name}
                      </span>
                    </td>
                    <td class="text-zinc-400 px-4 py-3">
                      {item.item_type}
                    </td>
                    <td class="px-4 py-3">
                      <Show when={item.rank_type === '4'} fallback={<span class="text-purple-400">A-Rank</span>}>
                        <span class="text-amber-400 font-bold">S-Rank</span>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <div class="text-xs text-zinc-500 text-center">
          Showing
          {' '}
          {data().length}
          {' '}
          records.
        </div>
      </Show>
    </div>
  )
}
