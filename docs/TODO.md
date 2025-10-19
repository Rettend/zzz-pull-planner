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

## Status (v2.3)

### Done

- Hardcoded v2.3 banners with assets wired in `src/lib/constants.ts`; icons rendered by `TargetIconCard` with attribute/specialty overlays and S-rank badge.
- Image helpers with Unknown fallback via `utils/assets` and constants exports.
- Probability engine: hazard tables (Agent 90, Engine 80), pity offset, PMF/CMF, EV and quantiles, featured-mixture (q: Agents 0.5, Engines 0.75), discrete convolution, budget `Pr(T ≤ B)`.
- Planner v1:
  - Priority-ordered allocation across phases.
  - Quantile-selected costs per target using current pity/guarantee and channel q (luck mode).
  - Phase 1 reserve carried for Phase 2; engine spend gated at phase start to keep reserve.
  - Phase success probabilities, per-phase budgets, funded target lists, totals (agentsGot, enginesGot, pullsLeftEnd).
- UI:
  - Target selection by phase window; drag-and-drop reordering.
  - Channel inputs (pity/guaranteed) per Agent and W-Engine.
  - Risk buttons p50/p60/p75/p90/EV with helper text; luck mode toggle.
  - Budget bars and success-probability badges; copy-to-clipboard summary.

### In progress

- Refine allocation policy (agents-first where applicable; stronger reserve enforcement for later Agents).
- Per-target surfaces (EV and quantiles).
- Copy cleanup to fully remove “pre-pull/pity bank” language.

## Next Focus (actionable)

- [ ] Implement agents-first rule and ensure Engines only after reserving for all later Agents at chosen risk.
- [ ] Add off-feature policy toggle (Stop vs Continue) and guarantee transitions; simulate Stop/Continue for Agents.
- [ ] Show per-target cards with p50/p60/p75/p90/EV, featured odds q, and resulting guarantee state.
- [ ] Compute overall plan success probability across both phases; display a totals badge.
- [ ] Validate persistence of per-channel state (pity/guaranteed); promote to a dedicated store if needed.
- [ ] Lazy-load images in lists; verify crisp rendering on dark backgrounds.
- [ ] Add unit tests: hazard math invariants, featured-mixture goldens, multi-target scenario sanity checks.
- [ ] Copy cleanup: remove any remaining “pre-pull/pity bank” mentions and clarify saving guidance.

## Milestones

- [x] M1: Data scaffolding (types, banners, assets).
- [x] M2: Probability engine (hazards, PMF/CMF, EV/quantiles, mixtures).
- [ ] M3: Planner engine (agents-first and policies, per-target outputs, overall probability).
- [ ] M4: UI polish (per-target cards, visuals, copy).
- [ ] M5: Tests + docs.
