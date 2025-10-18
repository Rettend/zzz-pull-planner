# Pull Planner Overhaul – Version 2.3 (Real Pity, No Bank, Hardcoded Banners)

This plan replaces the simplified N=60 model with a probability-accurate planner for ZZZ’s limited banners, removes any notion of “pity banking,” ignores the standard channel and A-ranks, hardcodes current 2.3 banners, and enables selecting exact targets with priorities.

## Scope & Assumptions

- No pity bank: users should not spend to “bank pity” – simply don’t pull. Do not model or suggest pre-pull.
- Only limited Agent and W-Engine channels are in scope; ignore Standard channel and A-ranks entirely.
- Banner guarantees carry across banners for the same channel type (Agent or W-Engine).
- Use real pity and guarantee mechanics:
  - Agents (limited): hard pity 90, soft pity ramp ~75+, featured probability q=0.5.
  - W-Engines: hard pity 80, soft pity ramp ~65+, featured probability q=0.75.
  - A-rank every 10 is out of scope for planning decisions (ignored in UI math).
- Risk-aware planning via quantiles (median/p75/p90/p95/p99) in addition to EV. Default to a safe quantile (e.g., p90).

## Hardcoded Banners (Version 2.3)

### Agent Banners (Limited)

- Wandering Night Lantern (10/15/2025 → 11/05/2025)
  - Featured: Lucia
- Soar Into the Gentle Night (10/15/2025 → 11/05/2025) (rerun)
  - Featured: Vivian
- Alone in a Shared Dream (11/05/2025 → 11/25/2025)
  - Featured: Yidhari
- Fu-rocious Feline (11/05/2025 → 11/25/2025) (rerun)
  - Featured: Ju Fufu

### W-Engine Banners (Limited)

- Dissonant Sonata (10/15/2025 → 11/05/2025)
  - Featured: Dreamlit Hearth
- Vibrant Resonance (10/15/2025 → 11/05/2025) (rerun)
  - Featured: Flight of Fancy
- Dazzling Choir (11/05/2025 → 11/25/2025)
  - Featured: Kraken's Cradle
- Dazzling Melody (11/05/2025 → 11/25/2025) (rerun)
  - Featured: Roaring Fur-nace

### Asset Hooks

assets/
├── agents/
│   ├── Ju_FuFu_Icon.webp
│   ├── Lucia_Icon.webp
│   ├── Vivian_Icon.webp
│   └── Yidhari_Icon.webp
├── attributes/
│   ├── Icon_Auric_Ink.webp
│   ├── Icon_Electric.webp
│   ├── Icon_Ether.webp
│   ├── Icon_Fire.webp
│   ├── Icon_Frost.webp
│   ├── Icon_Ice.webp
│   └── Icon_Physical.webp
├── specialties/
│   ├── Icon_Anomaly.webp
│   ├── Icon_Attack.webp
│   ├── Icon_Defense.webp
│   ├── Icon_Rupture.webp
│   ├── Icon_Stun.webp
│   └── Icon_Support.webp
├── w-engines/
│   ├── Dreamlit_Hearth_Icon.webp
│   ├── Flight_of_Fancy_Icon.webp
│   └── Roaring_Fur-nace_Icon.webp
├── Icon_Rank_S.webp
└── Unknown.webp

- Agents should use the agent icon as the background, then on top of that use: s rank icon top left, attribute icon top right, specialty icon bottom right
- W-Engines should use the w-engine icon as the background, then on top of that use: s rank icon top left, specialy icon bottom right

---

## Deliverables

1) Hardcoded 2.3 banner data module with image references.
2) Risk/quantile-based cost model using real soft/hard pity and guarantees.
3) Target selection UI (choose banners/targets, set priority, must-have vs optional).
4) Planner engine that allocates pulls across phases by priority, honors guarantees, and computes success probabilities; no pre-pull logic.
5) Updated UI (risk slider, probability badges, distribution-aware budget bars, copy updates removing “pre-pull”).
6) Documentation updates.

---

## Tasks

### 1. Data Layer

- [ ] Define types: `ChannelType = 'agent' | 'engine'`, `Banner`, `Target`, `DateRange`.
- [x] Create `src/data/banners.v23.ts` exporting the four Agent and four W-Engine banners listed above, including start/end dates and asset paths. (Implemented in `src/lib/constants.ts` as `BANNERS`.)
- [x] Implement image helper: resolve icon path by target name with fallback to `assets/Unknown.webp`.
- [ ] Persist per-account channel states (Agent, W-Engine): `{ pity: number; guaranteed: boolean; }` (carry across banners). No Standard channel state.

### 2. Probability Model (No Pity Bank)

- [ ] Store hazard tables per channel (Agents 1..90, Engines 1..80) with a soft pity ramp (default piecewise-linear: low base → ramp at ~75/65 → 100% at hard pity).
- [ ] Compute first S PMF/CMF: `P(T=k) = h_k * Π_{i<k}(1 - h_i)`; ensure CMF at hard pity is 1.
- [ ] Featured cost distribution when `guaranteed=false`: mixture of `T1` (prob q) and `T1 + T2` (prob 1−q), with pity reset between S’s.
- [ ] Featured cost distribution when `guaranteed=true`: distribution of `T1` only.
- [ ] Extract EV, quantiles (p50/p75/p90/p95/p99), and `Pr(T ≤ B)` for any budget B.
- [ ] Parameterize q by channel: Agents q=0.5, W-Engines q=0.75.

### 3. Planning Engine (Two Phases, Priorities)

- [x] Inputs: phase budgets (P0 + I1 → Phase 1; carry + I2 → Phase 2), selected targets with type (Agent or W-Engine), priority order, “Stop on off-feature” vs “Continue” policy per Agent channel. (Targets and priority integrated via `TargetPicker` and `stores/targets`.)
- [ ] Replace N-based costs with quantile-selected costs per target using current pity/guarantee/channel.
- [ ] Allocation policy:
  - [ ] Process targets in priority order across phases.
  - [ ] Allocate at chosen risk quantile (e.g., p90) for each target.
  - [ ] Agents first; Engines only after ensuring reserve for later Agents per chosen risk level.
  - [ ] Update guarantee state after each simulated S per policy:
    - If off-feature and policy=Stop: spend ends, guarantee=true carries to next banner.
    - If off-feature and policy=Continue: add second T, guarantee consumed; update pity=0 afterwards.
  - [x] No partial spending and no pre-pull; either fully fund a target within a phase or defer.
- [ ] Outputs:
  - [ ] Per target: EV, p50/p90/p95/p99 cost and `Pr(within current phase budget)`.
  - [ ] Per phase: budget start/end, funded targets, success probability to hit plan, pulls remaining.
  - [ ] Totals: count of Agents/Engines obtained, probability to achieve all selected targets, expected pulls left.

### 4. UI/UX

- [ ] Target selection panel:
  - [x] List banners grouped by phase window with icons, names, and dates.
  - [x] Allow selecting specific targets (e.g., Lucia, Yidhari, Roaring Fur-nace, etc.).
  - [ ] Drag-and-drop to set priority; mark targets as Must-have or Optional.
  - [x] Drag-and-drop to set priority (reordering implemented).
  - [x] For each channel, input current pity and guaranteed (Agent and W-Engine separately).
- [ ] Risk configuration:
  - [ ] Replace Best/Expected/Worst with a Risk slider (p50 → p99), plus a separate EV info toggle.
  - [ ] Policy toggle: “Stop on off-feature” vs “Continue until featured”.
- [ ] Planner visualization:
  - [ ] Budget bars with quantile bands (e.g., p50–p90 range) and tooltips for EV.
  - [ ] Badges showing `Pr(success within budget)` rather than binary affordable/not.
  - [ ] Cards per target: show EV, p50, p90, p95, p99, featured probability q, and guarantee state after action.
- [ ] Copy cleanup: remove all references to “pre-pull/pity bank”; tips emphasize “save pulls; do not pull if you need to conserve for later Agents”.

### 5. Assets Integration

- [x] Map Agent names → `assets/agents/*_Icon.webp` and W-Engine names → `assets/w-engines/*_Icon.webp`.
- [x] Use `assets/Unknown.webp` when a mapping is missing.
- [ ] Lazy-load images in lists; ensure crisp rendering on dark UI.

### 6. Documentation

- [ ] Update `docs/PLAN.md` to remove pre-pull guidance and N=60 shortcuts; describe risk/quantile approach and guarantee policies.
- [ ] Add `docs/BANNERS.v23.md` listing hardcoded banners and assets used.
- [ ] Note that Standard channel and A-ranks are intentionally out of scope.

### 7. Validation & QA

- [ ] Unit tests for hazard math (PMF sums to 1, CMF monotonic, quantiles correct).
- [ ] Golden test cases for cost distributions (Agents and Engines, guaranteed vs not, on/off-feature policies).
- [ ] Scenario checks: multi-target plans at different risk levels produce sensible reserves and probabilities.

### 8. Milestones

- [x] M1: Data scaffolding – types + banners + assets mapping.
- [ ] M2: Probability engine – hazards, PMF/CMF, EV/quantiles, mixtures.
- [ ] M3: Planner engine – priority allocation, policies, outputs.
- [ ] M4: UI – selection, risk slider, visuals, copy cleanup.
- [ ] M5: Docs + validation.

---

## Notes & Decisions

- No “pity bank” mechanics will be modeled or recommended.
- Standard channel and A-rank considerations are excluded by design.
- Guarantees are tracked per channel type (Agent vs W-Engine) and carry across banners.
- Risk defaults to p90 but can be adjusted by the user.
