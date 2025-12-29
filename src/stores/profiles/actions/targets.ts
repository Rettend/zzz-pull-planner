import type { SetStoreFunction } from 'solid-js/store'
import type { ProfilesState, ProfileTarget } from '../types'
import type { ChannelType } from '~/types/profile'

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

function normalizeTargets(targets: ProfileTarget[]): ProfileTarget[] {
  return targets.map((t, i) => ({ ...t, order: i }))
}

export function createTargetActions(
  state: ProfilesState,
  setState: SetStoreFunction<ProfilesState>,
  scheduleSync: () => void,
) {
  function updateCurrentTargets(updater: (targets: ProfileTarget[]) => ProfileTarget[]) {
    const profileIndex = state.profiles.findIndex(p => p.id === state.currentProfileId)

    if (profileIndex === -1) {
      setState('draft', 'targets', targets => normalizeTargets(updater([...targets])))
      return
    }
    setState('profiles', profileIndex, 'targets', targets => normalizeTargets(updater([...targets])))
  }

  function getCurrentTargets(): ProfileTarget[] {
    const profileIndex = state.profiles.findIndex(p => p.id === state.currentProfileId)
    if (profileIndex !== -1)
      return state.profiles[profileIndex].targets

    return state.draft.targets
  }

  return {
    addTarget: (target: { targetId: string, channelType: ChannelType }) => {
      const currentTargets = getCurrentTargets()
      // Only add if no copies of this target exist
      if (currentTargets.some(t => t.targetId === target.targetId))
        return

      updateCurrentTargets(targets => [
        ...targets,
        { id: createId(), targetId: target.targetId, channelType: target.channelType, order: targets.length },
      ])

      scheduleSync()
    },

    removeTarget: (targetId: string) => {
      updateCurrentTargets(targets => targets.filter(t => t.targetId !== targetId))
      scheduleSync()
    },

    removeEntry: (id: string) => {
      updateCurrentTargets(targets => targets.filter(t => t.id !== id))
      scheduleSync()
    },

    incrementMindscape: (targetId: string) => {
      updateCurrentTargets((targets) => {
        const sorted = [...targets].sort((a, b) => a.order - b.order)
        const indices = sorted.map((entry, idx) => ({ entry, idx })).filter(item => item.entry.targetId === targetId)

        if (!indices.length)
          return sorted

        const channel = indices[0].entry.channelType
        const maxLevel = channel === 'agent' ? 6 : 5 // M0 to M6 for agents, M0 to M5 for engines
        if (indices.length >= maxLevel + 1)
          return sorted

        // Insert new copy after the last copy of this target
        const insertAt = indices[indices.length - 1].idx + 1
        sorted.splice(insertAt, 0, {
          id: createId(),
          targetId,
          channelType: channel,
          order: insertAt,
        })

        return sorted
      })
      scheduleSync()
    },

    decrementMindscape: (targetId: string) => {
      updateCurrentTargets((targets) => {
        const sorted = [...targets].sort((a, b) => a.order - b.order)
        const indices = sorted.map((entry, idx) => ({ entry, idx })).filter(item => item.entry.targetId === targetId)

        if (!indices.length)
          return sorted

        // If only one copy, remove the target entirely
        if (indices.length === 1)
          return sorted.filter(t => t.targetId !== targetId)

        // Remove the last copy
        const removeIdx = indices[indices.length - 1].idx
        sorted.splice(removeIdx, 1)

        return sorted
      })
      scheduleSync()
    },

    reorderTargets: (fromIndex: number, toIndex: number) => {
      updateCurrentTargets((targets) => {
        const sorted = [...targets].sort((a, b) => a.order - b.order)
        const originalLen = sorted.length

        if (!originalLen)
          return sorted
        if (fromIndex < 0 || fromIndex >= originalLen)
          return targets
        if (toIndex < 0 || toIndex > originalLen)
          return targets

        const safeFrom = Math.max(0, Math.min(originalLen - 1, fromIndex))
        const [moved] = sorted.splice(safeFrom, 1)
        const clampedTarget = Math.max(0, Math.min(originalLen, toIndex))
        const insertAt = clampedTarget > safeFrom ? clampedTarget - 1 : clampedTarget
        sorted.splice(insertAt, 0, moved)

        return sorted
      })
      scheduleSync()
    },

    clearTargets: () => {
      updateCurrentTargets(() => [])
      scheduleSync()
    },
  }
}
