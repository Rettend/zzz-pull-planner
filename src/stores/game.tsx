import type { Accessor, ParentComponent } from 'solid-js'
import type { AgentMeta, Attribute, Banner, Specialty, WEngineMeta } from '~/lib/constants'
import { createContext, createResource, useContext } from 'solid-js'
import { clientEnv } from '~/env/client'
import { ATTRIBUTE_ICON, SPECIALTY_ICON, UNKNOWN_ICON } from '~/lib/constants'
import { getGameData } from '~/lib/data'

function getFullIconUrl(iconPath?: string): string | undefined {
  if (!iconPath) {
    return undefined
  }
  const baseUrl = clientEnv.VITE_R2_PUBLIC_URL
  if (!baseUrl) {
    return iconPath
  }
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

export const GameDataProvider: ParentComponent = (props) => {
  const [data] = createResource(async () => {
    const response = await getGameData()
    return response
  })

  const banners = () => {
    const fetched = data()?.banners || []
    return fetched.map(b => ({
      id: b.id,
      title: b.title,
      type: b.type,
      start: b.start,
      end: b.end,
      featured: b.featured, // This is the ID (slug) from DB
    }))
  }

  const resolveAgent = (nameOrId: string): AgentMeta | undefined => {
    const d = data()
    if (d) {
      // Try direct lookup by ID
      if (d.agents[nameOrId]) {
        const a = d.agents[nameOrId]
        return {
          name: a.name,
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
          specialty: w.specialty as Specialty,
          icon: getFullIconUrl(w.icon) ?? UNKNOWN_ICON,
        }
      }
      const found = Object.values(d.wEngines).find(w => w.name === nameOrId)
      if (found) {
        return {
          name: found.name,
          specialty: found.specialty as Specialty,
          icon: getFullIconUrl(found.icon) ?? UNKNOWN_ICON,
        }
      }
    }
    return undefined
  }

  const resolveAttributeIcon = (attr?: string) => {
    return attr ? (ATTRIBUTE_ICON[attr as Attribute] ?? UNKNOWN_ICON) : UNKNOWN_ICON
  }

  const resolveSpecialtyIcon = (spec?: string) => {
    return spec ? (SPECIALTY_ICON[spec as Specialty] ?? UNKNOWN_ICON) : UNKNOWN_ICON
  }

  return (
    <GameContext.Provider value={{
      banners,
      resolveAgent,
      resolveWEngine,
      resolveAttributeIcon,
      resolveSpecialtyIcon,
      loading: () => data.loading,
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
