import { useParams } from '@solidjs/router'
import { createMemo, For, Show } from 'solid-js'
import history1001 from '~/data/history_1001.json'
import history2001 from '~/data/history_2001.json'
import history3001 from '~/data/history_3001.json'
import history5001 from '~/data/history_5001.json'

const DATA_MAP: Record<string, any[]> = {
  'standard': history1001,
  'exclusive': history2001,
  'w-engine': history3001,
  'bangboo': history5001,
}

const RANK_COLORS: Record<string, string> = {
  3: 'text-purple-400',
  4: 'text-amber-400 font-bold',
}

const RANK_BG: Record<string, string> = {
  3: 'bg-purple-400/10',
  4: 'bg-amber-400/10',
}

export default function HistoryList() {
  const params = useParams()

  const data = createMemo(() => {
    const type = params.type
    if (!type)
      return []
    return DATA_MAP[type] || []
  })

  return (
    <div class="flex flex-col gap-4">
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
                    No records found.
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
    </div>
  )
}
