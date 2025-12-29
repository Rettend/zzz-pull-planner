import type { Accessor } from 'solid-js'
import type { Banner } from '~/lib/constants'
import type { SelectedTargetInput } from '~/lib/plan-view'
import type { PhasePlan, PhaseSettings, PlannerSettings, Scenario } from '~/lib/planner'
import type { ProfileTarget } from '~/types/profile'
import { toPng } from 'html-to-image'
import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { ShareablePlanCard } from '~/components/ShareablePlanCard'
import { Badge, BudgetBar, StatRow } from '~/components/ui'
import { Button } from '~/components/ui/button'
import { Modal } from '~/components/ui/modal'
import { SwitchCard } from '~/components/ui/switch'
import { formatPlanCopyText } from '~/lib/clipboard'
import { buildPhaseRanges, calculateDisplayedCost, channelBreakdownParts, createFundedMindscapes } from '~/lib/plan-view'
import { useGame } from '~/stores/game'
import { useProfilesStore } from '~/stores/profiles'
import { useUIStore } from '~/stores/ui'
import { TargetIconCard } from '../TargetIconCard'
import { ChannelCostRow } from './ChannelCostRow'
import { PhaseHeader } from './PhaseHeader'

interface PlanOverviewProps {
  banners: Accessor<Banner[]>
  plan: Accessor<PhasePlan>
  inputs: Accessor<PlannerSettings>
  scenario: Accessor<Scenario>
  selectedTargets: Accessor<SelectedTargetInput[]>
  sortedTargets: Accessor<ProfileTarget[]>
  phaseSettings: Accessor<Record<string, PhaseSettings>>
  onPhaseSettingsChange: (range: string, updates: Partial<PhaseSettings>) => void
  planningMode: Accessor<'s-rank' | 'a-rank'>
}

export function PlanOverview(props: PlanOverviewProps) {
  const [copied, setCopied] = createSignal(false)
  const [showShareModal, setShowShareModal] = createSignal(false)
  const [generating, setGenerating] = createSignal(false)

  const [, profileActions] = useProfilesStore()
  const profileName = createMemo(() => profileActions.currentProfile().name || 'My Plan')

  const [uiState, uiActions] = useUIStore()

  const [shareConfig, setShareConfig] = createSignal({
    showAccountName: true,
    showProbability: true,
    showScenario: true,
  })

  const [windowWidth, setWindowWidth] = createSignal(typeof window !== 'undefined' ? window.innerWidth : 0)

  const updateWidth = () => {
    if (typeof window !== 'undefined')
      setWindowWidth(window.innerWidth)
  }

  onMount(() => {
    updateWidth()
    window.addEventListener('resize', updateWidth)
  })

  onCleanup(() => {
    if (typeof window !== 'undefined')
      window.removeEventListener('resize', updateWidth)
  })

  const mobileScale = createMemo(() => {
    const w = windowWidth()
    if (w > 0 && w < 768)
      return w / 600

    return 1
  })

  const phaseRanges = createMemo(() => buildPhaseRanges(props.banners()))
  const totals = createMemo(() => props.plan().totals)

  const fundedMindscapes = createMemo(() => createFundedMindscapes(props.plan()))

  const selectedCounts = createMemo(() => {
    const selected = props.selectedTargets()
    return {
      agents: selected.filter(t => t.channel === 'agent').length,
      engines: selected.filter(t => t.channel === 'engine').length,
    }
  })

  const game = useGame()

  const commonParams = createMemo(() => ({
    banners: props.banners(),
    plan: props.plan(),
    scenario: props.scenario(),
    inputs: props.inputs(),
    selectedTargets: props.selectedTargets(),
    ranges: phaseRanges(),
    checkRarity: (name: string) => {
      const agent = game.resolveAgent(name)
      if (agent)
        return agent.rarity
      const engine = game.resolveWEngine(name)
      if (engine)
        return engine.rarity
      return 5
    },
  }))

  const displayedCosts = createMemo(() => {
    const common = commonParams()
    return props.plan().phases.map((p, i) => ({
      agent: calculateDisplayedCost({ ...common, phase: i, channel: 'agent' }),
      engine: calculateDisplayedCost({ ...common, phase: i, channel: 'engine' }),
    }))
  })

  const breakdowns = createMemo(() => {
    const common = commonParams()
    return props.plan().phases.map((p, i) => ({
      agent: channelBreakdownParts({ plan: props.plan(), phase: i, channel: 'agent', inputs: common.inputs, scenario: common.scenario, checkRarity: common.checkRarity }),
      engine: channelBreakdownParts({ plan: props.plan(), phase: i, channel: 'engine', inputs: common.inputs, scenario: common.scenario, checkRarity: common.checkRarity }),
    }))
  })

  const estimatedARanks = createMemo(() => {
    if (props.planningMode() !== 's-rank')
      return []

    const plan = props.plan()
    const totalAgentCost = plan.phases.reduce((acc, p) => acc + p.agentCost, 0)
    const totalEngineCost = plan.phases.reduce((acc, p) => acc + p.engineCost, 0)

    const selected = props.selectedTargets()
    const agents = selected.filter(t => t.channel === 'agent')
    const engines = selected.filter(t => t.channel === 'engine')

    const counts = new Map<string, number>()

    const addCount = (name: string, amount: number) => {
      counts.set(name, (counts.get(name) ?? 0) + amount)
    }

    if (agents.length > 0 && totalAgentCost > 0) {
      const costPerAgent = totalAgentCost / agents.length
      for (const t of agents) {
        const banner = props.banners().find(b => b.featured === t.name)
        if (banner) {
          const numFeatured = banner.featuredARanks.length || 2
          const ratePerSpecific = 0.094 * 0.5 / numFeatured
          const yieldCount = costPerAgent * ratePerSpecific
          for (const a of banner.featuredARanks)
            addCount(a, yieldCount)
        }
      }
    }

    if (engines.length > 0 && totalEngineCost > 0) {
      const costPerEngine = totalEngineCost / engines.length
      for (const t of engines) {
        const banner = props.banners().find(b => b.featured === t.name)
        if (banner) {
          const numFeatured = banner.featuredARanks.length || 2
          const ratePerSpecific = 0.150 * 0.5 / numFeatured
          const yieldCount = costPerEngine * ratePerSpecific
          for (const a of banner.featuredARanks)
            addCount(a, yieldCount)
        }
      }
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .filter(x => x.count >= 0.5)
  })

  const securedItems = createMemo(() => {
    const list: { name: string, level: number, channel: 'agent' | 'engine' }[] = []
    const funded = fundedMindscapes()

    for (const t of props.sortedTargets()) {
      if (funded.has(t.targetId)) {
        const level = funded.get(t.targetId)!
        if (level >= -1)
          list.push({ name: t.targetId, level, channel: t.channelType })
      }
    }
    return list
  })

  const missingItems = createMemo(() => {
    const list: { name: string, current: number, desired: number, channel: 'agent' | 'engine' }[] = []
    const funded = fundedMindscapes()

    const targetCounts = new Map<string, { channel: 'agent' | 'engine', count: number }>()
    for (const t of props.sortedTargets()) {
      const existing = targetCounts.get(t.targetId)
      if (existing)
        existing.count += 1
      else
        targetCounts.set(t.targetId, { channel: t.channelType, count: 1 })
    }

    for (const [targetId, { channel, count }] of targetCounts) {
      const current = funded.get(targetId) ?? -1
      const desired = count - 1

      if (current < desired)
        list.push({ name: targetId, current, desired, channel })
    }
    return list
  })

  async function onCopy() {
    try {
      const text = formatPlanCopyText(
        props.inputs(),
        props.scenario(),
        props.selectedTargets(),
        props.plan(),
        commonParams().checkRarity,
        (name, channel) => {
          if (channel === 'agent')
            return game.resolveAgent(name)?.name ?? name
          return game.resolveWEngine(name)?.name ?? name
        },
      )
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    catch {
      setCopied(false)
    }
  }

  async function onShare() {
    setShowShareModal(true)
  }

  async function generateImage(action: 'download' | 'copy') {
    const node = document.getElementById('shareable-plan-card')
    if (!node)
      return

    setGenerating(true)
    try {
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2 })

      if (action === 'download') {
        const link = document.createElement('a')
        link.download = `zzz-pull-plan-${new Date().toISOString().split('T')[0]}.png`
        link.href = dataUrl
        link.click()
      }
      else {
        const blob = await (await fetch(dataUrl)).blob()
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ])
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    }
    catch (err) {
      console.error('Failed to generate image', err)
    }
    finally {
      setGenerating(false)
    }
  }

  return (
    <div class="space-y-4">
      <div class="gap-4 grid">
        <div class="text-sm text-zinc-300 flex items-center justify-between">
          <div>
            Scenario:
            {' '}
            <span class="text-emerald-300">{props.scenario()}</span>
          </div>
          <div class="flex flex-wrap gap-2 items-center justify-end">
            <Badge
              ok={props.plan().totals.agentsGot >= selectedCounts().agents}
              label={`${props.plan().totals.agentsGot} Agents`}
              title="How many Agents from your selection are affordable across all phases"
            />
            <Badge
              ok={props.plan().totals.enginesGot >= selectedCounts().engines}
              label={`${props.plan().totals.enginesGot} Engines`}
              title="How many W-Engines from your selection are affordable across all phases"
            />
            <Badge label={`${Math.round(props.plan().totals.pullsLeftEnd)} left`} title="Estimated pulls remaining at the end of the plan" />
            <Button
              variant="gray"
              onClick={onCopy}
              title="Copy inputs, ordered targets, and plan summary"
              class="inline-flex gap-2 items-center"
            >
              <i class={`size-4 ${copied() ? 'i-ph:check-bold' : 'i-ph:clipboard-text-duotone'}`} />
              Copy
            </Button>
            <Button
              variant="green"
              onClick={onShare}
              title="Create a shareable image of your plan"
              class="inline-flex gap-2 items-center"
            >
              <i class="i-ph:share-network-duotone size-4" />
              Share
            </Button>
          </div>
        </div>

        <Modal
          open={showShareModal()}
          onClose={() => setShowShareModal(false)}
          title="Share Plan"
          maxWidthClass="md:max-w-5xl"
        >
          <div class="bg-zinc-950/50 flex flex-1 flex-col gap-6 overflow-auto lg:flex-row">
            {/* Preview Area */}
            <div class="flex flex-1 items-start justify-center overflow-hidden md:p-6 lg:min-h-[500px]">
              <div
                class="origin-top md:w-auto md:scale-85"
                style={{
                  width: windowWidth() < 768 ? '600px' : '800px',
                  transform: mobileScale() < 1 ? `scale(${mobileScale()})` : undefined,
                }}
              >
                <ShareablePlanCard
                  plan={props.plan()}
                  inputs={props.inputs()}
                  scenario={props.scenario()}
                  selectedTargets={props.selectedTargets()}
                  sortedTargets={props.sortedTargets()}
                  accountName={profileName()}
                  showAccountName={shareConfig().showAccountName}
                  showProbability={shareConfig().showProbability}
                  showScenario={shareConfig().showScenario}
                  pattern={uiState.local.shareCardPattern}
                />
              </div>
            </div>

            {/* Controls Sidebar */}
            <div class="p-4 shrink-0 w-full space-y-6 md:p-6 lg:w-72">
              <div class="flex flex-col gap-4">
                <h4 class="text-sm text-zinc-400 tracking-wider font-medium uppercase">Configuration</h4>

                <div class="space-y-3">
                  <SwitchCard
                    label="Show Account Name"
                    checked={shareConfig().showAccountName}
                    onChange={checked => setShareConfig(prev => ({ ...prev, showAccountName: checked }))}
                  />
                  <SwitchCard
                    label="Show Stats"
                    checked={shareConfig().showProbability}
                    onChange={checked => setShareConfig(prev => ({ ...prev, showProbability: checked }))}
                  />
                  <SwitchCard
                    label="Show Scenario"
                    checked={shareConfig().showScenario}
                    onChange={checked => setShareConfig(prev => ({ ...prev, showScenario: checked }))}
                  />
                </div>

                {/* Pattern Selector */}
                <div class="flex flex-col gap-2">
                  <span class="text-xs text-zinc-500 font-medium">Background</span>
                  <div class="flex gap-2">
                    {/* None */}
                    <button
                      onClick={() => uiActions.setShareCardPattern('none')}
                      class="border rounded-md flex shrink-0 h-10 w-10 transition-all items-center justify-center"
                      classList={{
                        'border-emerald-500 bg-emerald-500/20': uiState.local.shareCardPattern === 'none',
                        'border-zinc-700 bg-zinc-900 hover:border-zinc-600': uiState.local.shareCardPattern !== 'none',
                      }}
                      title="No pattern"
                    />

                    {/* Diagonal */}
                    <button
                      onClick={() => uiActions.setShareCardPattern('diagonal')}
                      class="border rounded-md flex shrink-0 h-10 w-10 transition-all items-center justify-center overflow-hidden"
                      classList={{
                        'border-emerald-500': uiState.local.shareCardPattern === 'diagonal',
                        'border-zinc-700 hover:border-zinc-600': uiState.local.shareCardPattern !== 'diagonal',
                      }}
                      title="Diagonal dashes"
                      style={{
                        'background-color': uiState.local.shareCardPattern === 'diagonal' ? 'rgba(16, 185, 129, 0.15)' : '#18181b',
                        'background-image': `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 5l10 10' stroke='rgba(16, 185, 129, 0.4)' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`,
                        'background-position': '-1px -1px',
                      }}
                    />

                    {/* Dots */}
                    <button
                      onClick={() => uiActions.setShareCardPattern('dots')}
                      class="border rounded-md flex shrink-0 h-10 w-10 transition-all items-center justify-center overflow-hidden"
                      classList={{
                        'border-emerald-500': uiState.local.shareCardPattern === 'dots',
                        'border-zinc-700 hover:border-zinc-600': uiState.local.shareCardPattern !== 'dots',
                      }}
                      title="Dots"
                      style={{
                        'background-color': uiState.local.shareCardPattern === 'dots' ? 'rgba(16, 185, 129, 0.15)' : '#18181b',
                        'background-image': `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='1.5' fill='rgba(16, 185, 129, 0.4)'/%3E%3C/svg%3E")`,
                        'background-position': '-1px -1px',
                      }}
                    />

                    {/* Plus */}
                    <button
                      onClick={() => uiActions.setShareCardPattern('plus')}
                      class="border rounded-md flex shrink-0 h-10 w-10 transition-all items-center justify-center overflow-hidden"
                      classList={{
                        'border-emerald-500': uiState.local.shareCardPattern === 'plus',
                        'border-zinc-700 hover:border-zinc-600': uiState.local.shareCardPattern !== 'plus',
                      }}
                      title="Plus signs"
                      style={{
                        'background-color': uiState.local.shareCardPattern === 'plus' ? 'rgba(16, 185, 129, 0.15)' : '#18181b',
                        'background-image': `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 6v8M6 10h8' stroke='rgba(16, 185, 129, 0.4)' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                        'background-position': '-1px -1px',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div class="pt-4 flex flex-wrap gap-2">
                <Button
                  variant="green"
                  onClick={() => generateImage('download')}
                  disabled={generating()}
                  class="inline-flex gap-2 items-center"
                >
                  <Show when={generating()} fallback={<i class="i-ph:download-simple-bold size-4" />}>
                    <i class="i-gg:spinner size-4 animate-spin" />
                  </Show>
                  Download
                </Button>

                <Button
                  variant="gray"
                  onClick={() => generateImage('copy')}
                  disabled={generating()}
                  class="inline-flex gap-2 items-center"
                >
                  <Show when={copied()} fallback={<i class="i-ph:copy-simple-bold size-4" />}>
                    <i class="i-ph:check-bold size-4" />
                  </Show>
                  {copied() ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>

        <For each={props.plan().phases}>
          {(phase, index) => {
            const range = phase.id
            const timing = createMemo(() => props.phaseSettings()[range]?.timing ?? 'end')
            const isStart = createMemo(() => timing() === 'start')
            const budget = createMemo(() => Math.round(isStart() ? phase.startBudget : phase.endBudget))
            const success = createMemo(() => (isStart() ? (phase.successProbStart ?? 0) : (phase.successProbEnd ?? 0)))

            const costs = createMemo(() => displayedCosts()[index()])
            const breakdown = createMemo(() => breakdowns()[index()])

            const title = createMemo(() => {
              const banner = props.banners().find(b => `${b.start}→${b.end}` === range)
              return banner ? (banner.title || `Phase ${index() + 1}`) : `Phase ${index() + 1}`
            })

            const successThreshold = createMemo(() => {
              switch (props.scenario()) {
                case 'p50': return 0.5
                case 'p60': return 0.6
                case 'p75': return 0.75
                case 'p90': return 0.9
                case 'ev': return 0.5
                default: return 0.5
              }
            })

            return (
              <div class="p-3 border border-zinc-700 rounded-lg bg-zinc-900/40 space-y-3">
                <PhaseHeader
                  title={title()}
                  budget={budget()}
                  success={success()}
                  successThreshold={successThreshold()}
                  timing={timing()}
                  onTimingChange={t => props.onPhaseSettingsChange(range, { timing: t })}
                />

                <BudgetBar
                  total={isStart() ? phase.startBudget : phase.endBudget}
                  segments={[
                    ...phase.itemDetails.map((item) => {
                      const displayName = item.channel === 'agent'
                        ? (game.resolveAgent(item.name)?.name ?? item.name)
                        : (game.resolveWEngine(item.name)?.name ?? item.name)
                      return {
                        value: item.cost,
                        color: item.funded
                          ? (item.channel === 'agent' ? 'bg-emerald-600/70' : 'bg-sky-600/70')
                          : 'bg-red-500/60',
                        label: item.channel === 'agent' ? 'Agent' : 'Engine',
                        title: `${displayName} (${item.funded ? 'Funded' : 'Unfunded'})`,
                      }
                    }),
                    {
                      value: isStart() ? phase.carryToNextPhaseStart : phase.carryToNextPhaseEnd,
                      color: 'bg-zinc-700',
                      label: 'Carry',
                      title: 'Pulls carried to next phase',
                    },
                  ]}
                />

                <ul class="gap-x-3 gap-y-1 grid grid-cols-1 md:grid-cols-[12rem_2rem_8rem_auto]">
                  <ChannelCostRow
                    label="Agents cost"
                    value={costs()?.agent ?? 0}
                    affordable={isStart() ? phase.canAffordAgentStart : phase.canAffordAgentEnd}
                    pityLabel={index() === 0 ? `-${Math.max(0, props.planningMode() === 's-rank' ? props.inputs().pityAgentS : props.inputs().pityAgentA)}` : ''}
                    explanation={breakdown()?.agent ?? null}
                    title="Aggregated cost to secure selected Agents"
                  />
                  <ChannelCostRow
                    label="Engines cost"
                    value={costs()?.engine ?? 0}
                    affordable={isStart() ? phase.canAffordEngineStart : phase.canAffordEngineEnd}
                    pityLabel={index() === 0 ? `-${Math.max(0, props.planningMode() === 's-rank' ? props.inputs().pityEngineS : props.inputs().pityEngineA)}` : ''}
                    explanation={breakdown()?.engine ?? null}
                    title="Aggregated cost to secure selected Engines"
                  />
                  <StatRow
                    label="Reserve for Next"
                    value={<span class="text-amber-300">{Math.round(phase.reserveForNextPhase)}</span>}
                    title="Minimum pulls to keep reserved at end of this phase for future targets"
                  />
                  <StatRow
                    label="Carry to Next"
                    value={isStart() ? phase.carryToNextPhaseStart : phase.carryToNextPhaseEnd}
                    badge={{
                      ok: (isStart() ? phase.carryToNextPhaseStart : phase.carryToNextPhaseEnd) >= phase.reserveForNextPhase,
                      label: (isStart() ? phase.carryToNextPhaseStart : phase.carryToNextPhaseEnd) >= phase.reserveForNextPhase ? 'meets reserve' : 'below reserve',
                    }}
                    title="Estimated pulls remaining after this phase"
                  />
                </ul>
              </div>
            )
          }}
        </For>

        <div class="space-y-6">
          <div class="flex gap-2 items-center">
            <div class="bg-zinc-800 flex-1 h-px" />
            <span class="text-xs text-zinc-500 tracking-wider font-medium uppercase">Plan Summary</span>
            <div class="bg-zinc-800 flex-1 h-px" />
          </div>

          <div class="gap-6 grid grid-cols-1 lg:grid-cols-2">
            {/* Left Column: Secured & Missing */}
            <div class="space-y-6">
              {/* Secured Section */}
              <Show when={securedItems().length > 0}>
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-emerald-400 font-medium flex gap-2 items-center">
                      <i class="i-ph:check-circle-fill" />
                      Funded
                    </h3>
                    <span class="text-xs text-zinc-500">
                      {totals().agentsGot}
                      {' '}
                      Agents,
                      {' '}
                      {totals().enginesGot}
                      {' '}
                      Engines
                    </span>
                  </div>
                  <div class="gap-3 grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))]">
                    <For each={securedItems()}>
                      {item => (
                        <div class="flex flex-col gap-1 items-center">
                          <TargetIconCard
                            name={item.name}
                            mindscapeLevel={item.level}
                            selected
                            met={true}
                            channel={item.channel}
                            class="!cursor-default"
                          />
                          <div class="text-xs text-emerald-300 font-medium px-2 py-0.5 border border-emerald-900/50 rounded bg-emerald-950/40 shadow-sm">
                            M
                            {item.level}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Missing Section */}
              <Show when={missingItems().length > 0}>
                <div class="flex flex-col gap-3 h-full">
                  <h3 class="text-red-400 font-medium flex gap-2 items-center">
                    <i class="i-ph:warning-circle-fill" />
                    Missing
                  </h3>
                  <div class="gap-3 grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))]">
                    <For each={missingItems()}>
                      {item => (
                        <div class="flex flex-col gap-1 transition-opacity items-center relative">
                          <div class="relative">
                            <TargetIconCard
                              name={item.name}
                              mindscapeLevel={item.desired}
                              selected
                              met={false}
                              channel={item.channel}
                              class="!cursor-default"
                            />
                          </div>
                          <div class="flex flex-wrap gap-1 w-full justify-center">
                            <Show
                              when={item.desired - item.current <= 3}
                              fallback={(
                                <div class="text-xs text-red-300 font-medium px-1.5 py-0.5 text-center border border-red-900/50 rounded bg-red-950/40 shadow-sm">
                                  M
                                  {item.current + 1}
                                  -M
                                  {item.desired}
                                </div>
                              )}
                            >
                              <For each={Array.from({ length: item.desired - item.current }, (_, i) => item.current + 1 + i)}>
                                {level => (
                                  <div class="text-xs text-red-300 font-medium px-1.5 py-0.5 text-center border border-red-900/50 rounded bg-red-950/40 min-w-[24px] shadow-sm">
                                    M
                                    {level}
                                  </div>
                                )}
                              </For>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>

            {/* Right Column: Estimated A-Ranks */}
            <Show when={estimatedARanks().length > 0}>
              <div class="flex flex-col gap-3 h-full">
                <h3 class="text-purple-400 font-medium flex gap-2 items-center">
                  <i class="i-ph:plus-circle-fill" />
                  Estimated A-Ranks
                </h3>
                <div class="flex-1">
                  <div class="gap-3 grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))]">
                    <For each={estimatedARanks()}>
                      {item => (
                        <div class="flex flex-col gap-1 items-center">
                          <TargetIconCard
                            name={item.name}
                            mindscapeLevel={Math.round(item.count) - 1}
                            selected
                            channel="agent"
                            class="!border-purple-500/60 !cursor-default"
                          />
                          <div class="text-xs text-purple-300 font-medium px-2 py-0.5 border border-purple-900/50 rounded bg-purple-950/40 shadow-sm">
                            ~
                            {Math.round(item.count)}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>
          </div>

          {/* Warnings & Stats */}
          <div class="text-sm pt-4 border-t border-zinc-800/50 gap-2 grid">
            <For each={props.plan().phases}>
              {(phase, index) => (
                <Show when={phase.shortfallEnd && (phase.shortfallEnd ?? 0) > 0}>
                  <div class="text-red-200 p-3 border border-red-900/30 rounded-md bg-red-950/20 flex gap-3 items-start">
                    <i class="i-ph:warning-bold mt-0.5 shrink-0" />
                    <div>
                      Phase
                      {' '}
                      {index() + 1}
                      {' '}
                      Not Met: You need
                      {' '}
                      <span class="text-red-100 font-bold">{Math.round(phase.shortfallEnd ?? 0)}</span>
                      {' '}
                      more pulls to fund everything up to this point.
                    </div>
                  </div>
                </Show>
              )}
            </For>

            <div class="p-3 border border-zinc-800 rounded-md bg-zinc-900/50 flex items-center justify-between">
              <span class="text-zinc-400">Remaining Pulls</span>
              <span class="text-lg text-emerald-300 font-mono">{Math.round(totals().pullsLeftEnd)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
