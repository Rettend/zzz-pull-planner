import type { ParentProps } from 'solid-js'
import { createContext, createSignal, useContext } from 'solid-js'

// Gacha types mapping
export const GACHA_TYPES = {
  1001: 'standard',
  2001: 'exclusive',
  3001: 'w-engine',
  5001: 'bangboo',
} as const

export type GachaTypeId = keyof typeof GACHA_TYPES
export type GachaTypeName = typeof GACHA_TYPES[GachaTypeId]

export interface PullRecord {
  uid: string
  gacha_id: string
  gacha_type: string
  item_id: string
  count: string
  time: string
  name: string
  lang: string
  item_type: string
  rank_type: string
  id: string
}

interface GachaLogResponse {
  retcode: number
  message?: string
  data?: {
    list: PullRecord[]
  }
}

export interface PullHistoryData {
  'standard': PullRecord[]
  'exclusive': PullRecord[]
  'w-engine': PullRecord[]
  'bangboo': PullRecord[]
}

interface PullHistoryState {
  data: PullHistoryData | null
  loading: boolean
  error: string | null
}

interface PullHistoryStore {
  state: () => PullHistoryState
  importFromUrl: (url: string) => Promise<void>
  clearData: () => void
  hasData: () => boolean
  getChannelData: (channel: GachaTypeName) => PullRecord[]
}

const PullHistoryContext = createContext<PullHistoryStore>()

export function usePullHistory(): PullHistoryStore {
  const context = useContext(PullHistoryContext)
  if (!context)
    throw new Error('usePullHistory must be used within PullHistoryProvider')

  return context
}

export function PullHistoryProvider(props: ParentProps) {
  const [state, setState] = createSignal<PullHistoryState>({
    data: null,
    loading: false,
    error: null,
  })

  async function fetchGachaLog(baseUrl: string, gachaTypeId: GachaTypeId): Promise<PullRecord[]> {
    const records: PullRecord[] = []
    let endId = '0'
    let hasMore = true

    while (hasMore) {
      const url = new URL(baseUrl)
      url.searchParams.set('gacha_type', String(gachaTypeId))
      url.searchParams.set('size', '20')
      url.searchParams.set('end_id', endId)

      const response = await fetch(`/api/gacha-proxy?url=${encodeURIComponent(url.toString())}`)

      if (!response.ok)
        throw new Error(`Failed to fetch gacha log: ${response.statusText}`)

      const result: GachaLogResponse = await response.json()

      if (result.retcode !== 0)
        throw new Error(result.message || `API error: ${result.retcode}`)

      const list = result.data?.list || []

      if (list.length === 0) {
        hasMore = false
      }
      else {
        records.push(...list)
        endId = list[list.length - 1].id
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    return records
  }

  async function importFromUrl(url: string): Promise<void> {
    setState({ data: null, loading: true, error: null })

    try {
      // Validate URL format
      if (!url.includes('getGachaLog') || !url.includes('authkey'))
        throw new Error('Invalid URL. Make sure you copied the Search History URL correctly.')

      const gachaTypeIds = Object.keys(GACHA_TYPES).map(Number) as GachaTypeId[]
      const results: PullHistoryData = {
        'standard': [],
        'exclusive': [],
        'w-engine': [],
        'bangboo': [],
      }

      for (const typeId of gachaTypeIds) {
        const channelName = GACHA_TYPES[typeId]
        results[channelName] = await fetchGachaLog(url, typeId)
      }

      setState({ data: results, loading: false, error: null })
    }
    catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
      throw error
    }
  }

  function clearData(): void {
    setState({ data: null, loading: false, error: null })
  }

  function hasData(): boolean {
    return state().data !== null
  }

  function getChannelData(channel: GachaTypeName): PullRecord[] {
    return state().data?.[channel] ?? []
  }

  const store: PullHistoryStore = {
    state,
    importFromUrl,
    clearData,
    hasData,
    getChannelData,
  }

  return (
    <PullHistoryContext.Provider value={store}>
      {props.children}
    </PullHistoryContext.Provider>
  )
}
