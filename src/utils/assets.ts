import IconUnknown from '~/assets/Unknown.webp'

const agentIconModules = import.meta.glob('~/assets/agents/*.{webp,png,jpg,jpeg}', { eager: true, import: 'default' }) as Record<string, string>
const wEngineIconModules = import.meta.glob('~/assets/w-engines/*.{webp,png,jpg,jpeg}', { eager: true, import: 'default' }) as Record<string, string>
const attributeIconModules = import.meta.glob('~/assets/attributes/*.{webp,png,jpg,jpeg}', { eager: true, import: 'default' }) as Record<string, string>
const specialtyIconModules = import.meta.glob('~/assets/specialties/*.{webp,png,jpg,jpeg}', { eager: true, import: 'default' }) as Record<string, string>

function filenameFromPath(path: string): string {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(i + 1) : path
}

function stripSuffixes(base: string): string {
  return base.replace(/^Icon_/, '').replace(/_Icon$/, '')
}

function baseName(path: string): string {
  const file = filenameFromPath(path)
  return stripSuffixes(file.replace(/\.[^.]+$/, ''))
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildMap(mods: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [p, url] of Object.entries(mods)) {
    const key = normalizeName(baseName(p))
    map[key] = url
  }
  return map
}

const AGENT_ICONS = buildMap(agentIconModules)
const WENGINE_ICONS = buildMap(wEngineIconModules)
const ATTRIBUTE_ICONS = buildMap(attributeIconModules)
const SPECIALTY_ICONS = buildMap(specialtyIconModules)

export function resolveAgentIcon(name: string): string {
  return AGENT_ICONS[normalizeName(name)] ?? IconUnknown
}

export function resolveWEngineIcon(name: string): string {
  return WENGINE_ICONS[normalizeName(name)] ?? IconUnknown
}

export function resolveAttributeIconByName(name: string): string {
  return ATTRIBUTE_ICONS[normalizeName(name)] ?? IconUnknown
}

export function resolveSpecialtyIconByName(name: string): string {
  return SPECIALTY_ICONS[normalizeName(name)] ?? IconUnknown
}
