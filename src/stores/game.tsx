import type { Accessor, ParentProps } from 'solid-js'
import type { AgentMeta, Attribute, Banner, Specialty, WEngineMeta } from '~/lib/constants'
import type { GameData } from '~/remote/game'
import { revalidate } from '@solidjs/router'
import { createContext, onMount, useContext } from 'solid-js'
import { clientEnv } from '~/env/client'
import { UNKNOWN_ICON } from '~/lib/constants'
import { getGameData } from '~/remote/game'

function getFullIconUrl(iconPath?: string): string | undefined {
  if (!iconPath)
    return undefined

  const baseUrl = clientEnv.VITE_R2_PUBLIC_URL
  if (!baseUrl)
    return iconPath

  return `${baseUrl}/${iconPath}`
}

interface GameContextType {
  banners: Accessor<Banner[]>
  resolveAgent: (name: string) => AgentMeta | undefined
  resolveWEngine: (name: string) => WEngineMeta | undefined
  resolveAttributeIcon: (attr?: string) => string
  resolveSpecialtyIcon: (spec?: string) => string
  loading: Accessor<boolean>
}

const GameContext = createContext<GameContextType>()

interface GameDataProviderProps extends ParentProps {
  data: Accessor<GameData | undefined>
}

export function GameDataProvider(props: GameDataProviderProps) {
  // Data is loaded at route level and passed in - no createAsync here!
  const data = () => props.data()

  onMount(() => {
    const d = data()
    if (d && d.banners.length === 0)
      revalidate(getGameData.key)
  })

  const banners = () => {
    const d = data()
    const fetched = d?.banners || []
    return fetched.map((b) => {
      const featuredARanks = b.featuredTargets.filter((id) => {
        // Check agent rarity
        if (d?.agents[id]?.rarity === 4)
          return true
        // Check engine rarity
        if (d?.wEngines[id]?.rarity === 4)
          return true
        return false
      })

      return {
        id: b.id,
        title: b.title,
        type: b.type,
        start: b.start,
        end: b.end,
        featured: b.featured,
        featuredARanks,
      }
    })
  }

  const resolveAgent = (nameOrId: string): AgentMeta | undefined => {
    const d = data()
    if (d) {
      // Try direct lookup by ID
      if (d.agents[nameOrId]) {
        const a = d.agents[nameOrId]
        return {
          name: a.name,
          rarity: a.rarity,
          attribute: a.attribute as Attribute,
          specialty: a.specialty as Specialty,
          icon: getFullIconUrl(a.icon) ?? UNKNOWN_ICON,
        }
      }
      // Try lookup by Name (slow but safe)
      const found = Object.values(d.agents).find(a => a.name === nameOrId)
      if (found) {
        return {
          name: found.name,
          rarity: found.rarity,
          attribute: found.attribute as Attribute,
          specialty: found.specialty as Specialty,
          icon: getFullIconUrl(found.icon) ?? UNKNOWN_ICON,
        }
      }
    }
    return undefined
  }

  const resolveWEngine = (nameOrId: string): WEngineMeta | undefined => {
    const d = data()
    if (d) {
      if (d.wEngines[nameOrId]) {
        const w = d.wEngines[nameOrId]
        return {
          name: w.name,
          rarity: w.rarity,
          specialty: w.specialty as Specialty,
          icon: getFullIconUrl(w.icon) ?? UNKNOWN_ICON,
        }
      }
      const found = Object.values(d.wEngines).find(w => w.name === nameOrId)
      if (found) {
        return {
          name: found.name,
          rarity: found.rarity,
          specialty: found.specialty as Specialty,
          icon: getFullIconUrl(found.icon) ?? UNKNOWN_ICON,
        }
      }
    }
    return undefined
  }

  const resolveAttributeIcon = (attr?: string) => {
    const d = data()
    if (attr && d?.attributes[attr]?.icon)
      return getFullIconUrl(d.attributes[attr].icon) ?? UNKNOWN_ICON

    return UNKNOWN_ICON
  }

  const resolveSpecialtyIcon = (spec?: string) => {
    const d = data()
    if (spec && d?.specialties[spec]?.icon)
      return getFullIconUrl(d.specialties[spec].icon) ?? UNKNOWN_ICON

    return UNKNOWN_ICON
  }

  return (
    <GameContext.Provider value={{
      banners,
      resolveAgent,
      resolveWEngine,
      resolveAttributeIcon,
      resolveSpecialtyIcon,
      loading: () => false,
    }}
    >
      {props.children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx)
    throw new Error('useGame must be used within GameDataProvider')
  return ctx
}
