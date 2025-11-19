# Automated Data + Asset Refresh Plan

## 1. Goals & Constraints

- Stop hard-coding banners/assets in `constants.ts`; serve live data.
- Source of truth remains the Fandom history pages (no official API).
- Updates should be hands-off: a scheduled job ingests new rows + icons.
- Keep bundle small: the client fetches data via SolidStart server functions backed by D1.
- Prefer deterministic, idempotent jobs so manual re-runs are safe.

## 2. High-Level Architecture

1. **Cloudflare Worker (cron-triggered)**
    - Runs daily at 4AM UTC (can temporarily drop to 5-min cadence for manual refresh) and on-demand via dashboard.
    - Fetches both history pages (Agent and W-Engine).
    - Parses tables into normalized JSON (banner slug, featured name, aliases, dates, version).
    - Resolves the associated icon URLs and pushes binary blobs into R2 (images are ~50 kB WebPs, so R2 is the canonical store).
    - Upserts records into D1 using Drizzle.
    - Stores the scrape run status + diff summary for observability.
2. **Cloudflare D1 + Drizzle Schema**
    - Central relational store for banners, units, banner-unit relations, and scrape metadata.
3. **SolidStart server functions**
    - Read-only API that front-end uses (loaders/actions) to fetch `active`, `upcoming`, `past`, plus metadata like attributes/specialties and asset URLs.

## 3. Data Acquisition Strategy

- **Preferred**: Use the MediaWiki JSON endpoint `https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Exclusive_Channel/History&prop=text&format=json` (and the analogous W-Engine URL). It includes the rendered table HTML and all attributes needed for scraping.
- Normalize text (names, aliases, dates) using utility functions shared between Worker and SolidStart (common module).
- Only care about limited S-Rank Agents and W-Engines (new and reruns)

### Parsing checklist

- `<table class="article-table sortable tdc5">` `<tbody>` `<tr>`
- Each `<tr>` contains: channel name, multiple aliases, display name, start/end, version.
- Use the `data-image-key` attribute to capture the exact filename (`Agent_Yidhari_Murphy_Icon.png`). Store both the friendly `card-label` text and canonical slug.
- Convert localized dates ("November 5, 2025") via `new Date(text).toISOString()`; Workers already support `Date` parsing + `Date.UTC`.

## 4. Data Model (Drizzle schema sketch)

(done)

## 5. Worker Flow (cron job)

1. **Entry**: scheduled handler.
2. Fetch both pages in parallel with retries and ETag caching.
3. Parse rows → domain objects (`BannerDraft`, `UnitDraft`).
4. Filter rows so only the current version’s banners and any future-dated banners are processed (no historical backfill).
5. Compare against stored records:
    - New banner → insert + link units.
    - Updated dates/title/version → update.
    - Missing unit attribute/specialty → enrich via static map (still needed once) or "attributes" wiki page.
6. For each unique icon filename encountered:
    - Build canonical download URL: `https://static.wikia.../revision/latest/` (strip scaling segment automatically by splitting at `/scale-to-width-down`).
    - Fetch binary; stream to R2 at key `targets/<normalized>.webp` (Workers can convert via the `image` module if you want consistent format) or keep PNG/WebP as-is.
    - Store `iconPath` + `iconEtag` (hash of bytes) in the `targets` row.

7. Commit DB transaction.
8. Record scrape run + diff summary (counts of added/updated) for dashboards.

## 6. SolidStart Server Functions

- Create RPC-style Solid server functions using `query`/`action` from `@solidjs/router` (e.g., `export const getTargets = query(async () => ...)`).
- Expose queries:
  - `getBanners(state: 'active' | 'upcoming' | 'past')`
  - `getTargets(ids?: string[])`
  - `getMetadata()` for attributes/specialties.
- Client uses `createAsync` / `useAction` to call these; no REST routes required.
- Delete `constants.ts`, we use src/server/*.ts for server functions; always use input schema validation with zod v4

## 7. Assets in the Front-End

- Fetch images from R2
- `resolveAgentIcon` etc. map directly to `targets.iconPath` values.
- Consider `ssr: true` for the app, so Worker can fetch images and include them with the initial HTML.

## 9. Operational Considerations

- **Error reporting**: Workers Observability handles this
- **Rate limits**: Respect Fandom by adding `cf.fetch` headers (`User-Agent`) and `waitUntil` to stagger icon fetches.
- **Cache busting**: store last-known `data-image-key`. When the wiki updates an icon, the filename usually changes; detect difference to force re-download.
- **Scope trimming**: scraper only touches the current release windows (v2.3 and onward) plus any future-dated rows, so historical banners remain untouched, when old targets rerun they are included again in the history.

## 10. Implementation Milestones

1. [x] Add Drizzle schema + migrations for `banners`, `units`, `banner_units`, `scrape_runs`.
2. Implement SolidStart server endpoints that read from D1 (still with manual seed) to prove the client path works.
3. Build the Worker scraper simply in `src/worker`, sharing utilities `src/lib`.
4. Add Cron trigger + on-demand route.
5. Wire icon storage to R2 and switch the front-end icon resolvers.
6. Remove static `constants.ts` data once live data is in db.
