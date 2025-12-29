import type { SelectedTargetInput } from '~/lib/plan-view'
import type { PhasePlan, PlannerSettings } from '~/lib/planner'
import type { ProfileTarget } from '~/types/profile'
import { Link, Meta, Title } from '@solidjs/meta'
import { createMemo, Show } from 'solid-js'
import { ClientOnly } from '~/components/ClientOnly'
import { PlannerInputsPanel } from '~/components/home/PlannerInputsPanel'
import { PlanOverview } from '~/components/home/PlanOverview'
import { ProfilesTabs } from '~/components/home/ProfilesTabs'
import { SavePlanBanner } from '~/components/home/SavePlanBanner'
import { TargetPicker } from '~/components/TargetPicker'
import { isBannerPast } from '~/lib/constants'
import { computePlan, emptyPlan } from '~/lib/planner'
import { useGame } from '~/stores/game'
import { useProfilesStore } from '~/stores/profiles'
import { useUIStore } from '~/stores/ui'

export default function Home() {
  return (
    <>
      <Title>ZZZ Pull Planner - Calculator & Tracker</Title>
      <Meta name="description" content="ZZZ Pull Planner and Tracker. Calculate pull probabilities, track your history, simulate pulls, and plan your savings for Zenless Zone Zero." />
      <Link rel="canonical" href="https://zzz.rettend.me/" />

      <Meta property="og:title" content="ZZZ Pull Planner & Tracker" />
      <Meta property="og:description" content="Plan your pulls in Zenless Zone Zero. Calculate probabilities, track pity, simulate outcomes, and manage your Polychrome savings." />
      <Meta property="og:url" content="https://zzz.rettend.me/" />

      <Meta name="twitter:title" content="ZZZ Pull Planner & Tracker" />
      <Meta name="twitter:description" content="Plan your pulls in Zenless Zone Zero. Calculate probabilities, track pity, simulate outcomes, and manage your Polychrome savings." />

      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          'name': 'ZZZ Pull Planner',
          'url': 'https://zzz.rettend.me',
          'description': 'Plan your pulls in Zenless Zone Zero. Calculate probabilities, track pity, simulate outcomes, and manage your Polychrome savings.',
          'applicationCategory': 'GameUtility',
          'operatingSystem': 'Any',
          'offers': {
            '@type': 'Offer',
            'price': '0',
            'priceCurrency': 'USD',
          },
          'author': {
            '@type': 'Person',
            'name': 'Rettend',
            'url': 'https://rettend.me',
          },
        })}
      </script>
      <HomeContent />
    </>
  )
}

function HomeContent() {
  const [ui, uiActions] = useUIStore()
  const [profilesState, profileActions] = useProfilesStore()
  const game = useGame()
  const settings = () => profileActions.currentSettings()
  const phaseSettings = () => profileActions.currentPhaseSettings()
  const inputs = createMemo<PlannerSettings>(() => ({ ...settings(), phaseSettings: phaseSettings() }))
  const scenario = createMemo(() => settings().scenario)
  const planningMode = createMemo(() => settings().planningMode ?? 's-rank')

  const activeBanners = createMemo(() => game.banners().filter(b => !isBannerPast(b)))
  const currentTargets = createMemo(() => profileActions.currentProfile().targets ?? [])

  const showSavePlanBanner = createMemo(() => {
    if (profileActions.isServerMode())
      return false
    if (ui.local.savePlanBannerDismissed)
      return false
    return ui.local.savePlanBannerShown
  })

  const filteredTargets = createMemo(() => {
    const mode = planningMode()
    return currentTargets().filter((t) => {
      const meta = t.channelType === 'agent' ? game.resolveAgent(t.targetId) : game.resolveWEngine(t.targetId)
      const rarity = meta?.rarity ?? 5
      return mode === 's-rank' ? rarity === 5 : rarity === 4
    })
  })

  const selectedTargets = createMemo<SelectedTargetInput[]>(() =>
    filteredTargets().map(t => ({ name: t.targetId, channel: t.channelType })),
  )

  const sortedTargets = createMemo<ProfileTarget[]>(() =>
    [...filteredTargets()].sort((a, b) => a.order - b.order),
  )

  const plan = createMemo<PhasePlan>(() => {
    try {
      return computePlan(activeBanners(), inputs(), scenario(), selectedTargets())
    }
    catch {
      return emptyPlan()
    }
  })

  const featuredAgentNames = createMemo(() => {
    const banners = activeBanners()
    const names = new Set<string>()
    for (const b of banners) {
      if (b.type === 'agent') {
        const agent = game.resolveAgent(b.featured)
        if (agent)
          names.add(agent.name)
      }
    }
    return Array.from(names)
  })

  return (
    <div class="mx-auto max-w-7xl relative space-y-6">
      <ClientOnly>
        <Show when={showSavePlanBanner()}>
          <SavePlanBanner
            loading={profilesState.loading}
            onSave={() => profileActions.promoteToPersisted()}
            onDismiss={() => uiActions.setSavePlanBannerDismissed(true)}
          />
        </Show>
      </ClientOnly>
      <section class="p-2 border border-zinc-700 rounded-xl bg-zinc-800/50">
        <ProfilesTabs />
      </section>

      <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-3">
        <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Select Targets</h2>
        <ClientOnly>
          <TargetPicker />
        </ClientOnly>
      </section>

      <div class="gap-6 grid lg:grid-cols-[1fr_2fr]">
        <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 h-fit space-y-4">
          <h2 class="text-lg text-emerald-300 tracking-wide font-bold md:mb-4">Inputs</h2>
          <PlannerInputsPanel />
        </section>

        <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 h-full space-y-4">
          <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Plan</h2>
          <ClientOnly>
            <PlanOverview
              banners={activeBanners}
              plan={plan}
              inputs={inputs}
              scenario={scenario}
              selectedTargets={selectedTargets}
              sortedTargets={sortedTargets}
              phaseSettings={phaseSettings}
              onPhaseSettingsChange={(range, updates) => profileActions.setPhaseSettings(range, updates)}
              planningMode={planningMode}
            />
          </ClientOnly>
        </section>
      </div>

      <section class="text-sm text-zinc-500 mt-12 pt-8 border-t border-zinc-800 flex flex-col gap-4">
        <h1 class="text-lg text-zinc-400 font-bold">ZZZ Pull Planner & Tracker</h1>
        <p>
          This tool helps you calculate the probabilities for getting the limited agents in
          {' '}
          <strong>Zenless Zone Zero</strong>
          .
          Track your pity, manage your Polychrome savings, and simulate pulls to see your chances. The
          {' '}
          <strong>ZZZ Pull Planner</strong>
          {' '}
          has detailed cost breakdowns and different safety floors (p50, p75, p90).
        </p>
        <p>
          It's automatically updated with the latest banners, so you can plan your pulls for the latest agents like
          {' '}
          {featuredAgentNames().length > 0
            ? featuredAgentNames().slice(0, 4).map((name, i) => (
                <>
                  {i > 0 ? ', ' : ''}
                  <strong>{name}</strong>
                </>
              ))
            : <strong>Ellen</strong>}
          , and their W-Engines!
        </p>
      </section>
    </div>
  )
}
