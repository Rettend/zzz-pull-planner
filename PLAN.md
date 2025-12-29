# SSR & Data Persistence - Schema Redesign

## Current Problems

### 1. Inputs Not Persisting Correctly

- The UI inputs reset or jump to wrong values
- JSON columns (`plannerInputsJson`, `phaseTimingsJson`) are error-prone
- Sync state is complex and race-condition prone

### 2. Phase Shifting Problem

- `incomes` array indexed by phase index (0, 1, 2...)
- When banners pass, phases shift - income[0] now applies to a different banner
- `phaseTimings` has same issue - key is phase index, not phase-anchored

### 3. Special Banner Handling (Christmas, etc.)

- Sometimes both banner phases overlap (same start/end dates)
- Currently these would create 2 phases with identical date ranges
- Should collapse into 1 phase when date ranges are identical

### 4. Monolithic Store

- `src/stores/profiles.tsx` is 670+ lines
- Mixes types, helpers, targets, profiles, inputs, and sync logic
- Hard to maintain and reason about

---

## Proposed New Schema

### Design Principles

1. **No JSON blobs** - explicit columns for all settings
2. **Phase-anchored data** - income/timings keyed by phase range string, not index
3. **Per-channel pity** - explicit columns for S-rank vs A-rank state
4. **Simple sync** - upsert on primary key, no complex reconciliation
5. **Remove N field** - unused, always was 60

### New Tables

```sql
-- Profile-level settings (non-phase-specific)
profile_settings:
  profile_id: TEXT PK FK profiles.id

  -- Global inputs
  pulls_on_hand: INTEGER DEFAULT 0

  -- S-Rank pity state
  pity_agent_s: INTEGER DEFAULT 0
  guaranteed_agent_s: BOOLEAN DEFAULT false
  pity_engine_s: INTEGER DEFAULT 0
  guaranteed_engine_s: BOOLEAN DEFAULT false

  -- A-Rank pity state
  pity_agent_a: INTEGER DEFAULT 0
  guaranteed_agent_a: BOOLEAN DEFAULT false
  pity_engine_a: INTEGER DEFAULT 0
  guaranteed_engine_a: BOOLEAN DEFAULT false

  -- Planner preferences
  scenario: TEXT DEFAULT 'p60'
  planning_mode: TEXT DEFAULT 's-rank'
  luck_mode: TEXT DEFAULT 'realistic'

  created_at, updated_at

-- Phase-specific settings (keyed by date range, not index)
profile_phase_settings:
  profile_id: TEXT FK profiles.id
  phase_range: TEXT  -- e.g., "2025-01-01→2025-01-15"

  -- Income for this phase
  income: INTEGER DEFAULT 75

  -- Start/End toggle for display
  timing: TEXT DEFAULT 'end' -- 'start' | 'end'

  PRIMARY KEY (profile_id, phase_range)
```

### Phase Range Handling

Phases are computed from active banners by their unique date ranges:

- Normal: Banner A (Jan 1-15), Banner B (Jan 15-29) → 2 phases
- Christmas overlap: Both banners (Dec 25-Jan 8) → 1 phase (collapsed)

The `phase_range` key is the string `"${start}→${end}"` computed from banner dates.

When banners have the same date range, they share one phase = one income = one timing setting.

---

## Store Refactoring Plan

### Current Structure (monolithic)

```txt
src/stores/profiles.tsx (670+ lines)
├── Types (ProfileTarget, Profile, ProfilesState, etc.)
├── Helpers (normalizeTargets, defaultPlannerInputs, serverToLocalProfile, etc.)
├── Actions (addProfile, addTarget, setPlannerInput, sync logic, etc.)
└── Provider component
```

### Proposed Structure (modular)

```txt
src/stores/
├── types.ts              -- All store-related types
├── helpers.ts            -- Pure functions (normalize, defaults, converters)
├── profiles/
│   ├── provider.tsx      -- ProfilesStoreProvider component
│   ├── context.ts        -- Context and useProfilesStore hook
│   ├── actions.ts        -- Action creators (addProfile, deleteProfile, etc.)
│   └── sync.ts           -- Debounced sync logic
├── inputs/
│   ├── actions.ts        -- setPlannerInput, setScenario, etc.
│   └── defaults.ts       -- Default values
└── targets/
    └── actions.ts        -- addTarget, removeTarget, reorderTargets, etc.
```

### Refactoring Feasibility: ✅ Very Feasible

SolidJS stores are just plain objects - we can:

1. Extract types to separate files ✅
2. Extract helper functions ✅
3. Keep actions as standalone functions that receive `setState` ✅
4. The provider can import and compose these pieces

The key is that `setState` from `createStore` can be passed to action functions.

---

## Migration Plan

### Phase 1: Store Refactoring (prep work)

1. [ ] Create `src/stores/types.ts` - move all types
2. [ ] Create `src/stores/helpers.ts` - move pure functions
3. [ ] Verify app still works
4. [ ] Split actions into logical groups (optional, can do later)

### Phase 2: Schema Changes

1. [ ] Update `src/db/schema.ts` with new table structure
2. [ ] Update `src/db/relations.ts` with new relations
3. [ ] Run `drizzle-kit generate` and `drizzle-kit push:sqlite`
4. [ ] Delete existing local.db data (fresh start)

### Phase 3: Server Functions

1. [ ] Update `src/remote/profiles.ts`:
   - `getProfiles` → read new structured columns
   - `saveProfileSettings` → upsert structured data
   - Add `saveProfilePhaseSettings` → upsert per-phase settings
2. [ ] Remove all JSON parsing/stringifying logic

### Phase 4: Store Updates

1. [ ] Update `src/stores/profiles/` to use new types
2. [ ] Simplify `doSync()` to upsert structured data
3. [ ] Remove `syncInProgress` complexity (shouldn't be needed with proper upserts)

### Phase 5: UI Components

1. [ ] Update `PlannerInputsPanel.tsx` to use new store shape
2. [ ] Update `PlanOverview.tsx` for phase-keyed incomes/timings
3. [ ] Update income inputs to use phase_range key

### Phase 6: Cleanup

1. [ ] Remove debug console.log statements
2. [ ] Remove `N` field from all types and code
3. [ ] Test all user modes: Anon, Guest, Member
4. [ ] Remove ClientOnly wrappers and verify SSR works

---

## New Data Types

```typescript
// stores/types.ts

export interface ProfileSettings {
  pullsOnHand: number

  // S-Rank pity
  pityAgentS: number
  guaranteedAgentS: boolean
  pityEngineS: number
  guaranteedEngineS: boolean

  // A-Rank pity
  pityAgentA: number
  guaranteedAgentA: boolean
  pityEngineA: number
  guaranteedEngineA: boolean

  // Preferences
  scenario: 'p50' | 'p60' | 'p75' | 'p90' | 'ev'
  planningMode: 's-rank' | 'a-rank'
  luckMode: 'best' | 'realistic' | 'worst'
}

export interface PhaseSettings {
  income: number
  timing: 'start' | 'end'
}

export interface Profile {
  id: string
  name: string
  targets: ProfileTarget[]
  settings: ProfileSettings
  phaseSettings: Record<string, PhaseSettings> // keyed by phase_range
}

export interface ProfileTarget {
  targetId: string
  channelType: 'agent' | 'engine'
  count: number
  order: number
}
```

---

## Default Values

```typescript
export function defaultSettings(): ProfileSettings {
  return {
    pullsOnHand: 0,
    pityAgentS: 0,
    guaranteedAgentS: false,
    pityEngineS: 0,
    guaranteedEngineS: false,
    pityAgentA: 0,
    guaranteedAgentA: false,
    pityEngineA: 0,
    guaranteedEngineA: false,
    scenario: 'p60',
    planningMode: 's-rank',
    luckMode: 'realistic',
  }
}

export function defaultPhaseSettings(): PhaseSettings {
  return {
    income: 75,
    timing: 'end',
  }
}
```

---

## Testing Checklist

After migration:

- [ ] Fresh page load shows correct default values
- [ ] Changing pulls_on_hand persists on reload
- [ ] Changing pity values persists on reload
- [ ] Changing scenario/luck_mode persists on reload
- [ ] Per-phase income changes persist on reload
- [ ] Per-phase timing changes persist on reload
- [ ] Christmas overlap scenario shows 1 phase, not 2
- [ ] Works for Anon (in-memory), Guest, and Member modes
- [ ] No hydration errors on SSR
- [ ] Remove ClientOnly wrappers successfully
