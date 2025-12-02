import { Link, Meta, Title } from '@solidjs/meta'

export default function Guide() {
  return (
    <main class="text-emerald-100 font-mono">
      <Title>Guide - ZZZ Pull Planner & Tracker</Title>
      <Meta name="description" content="How to use the ZZZ Pull Planner to create your pull strategy. Learn about priority lists, luck settings, and safety floors for probability calculations." />
      <Link rel="canonical" href="https://zzz.rettend.me/guide" />

      <Meta property="og:title" content="Guide - ZZZ Pull Planner & Tracker" />
      <Meta property="og:description" content="How to use the ZZZ Pull Planner to create your pull strategy. Learn about priority lists, luck settings, and safety floors for probability calculations." />
      <Meta property="og:url" content="https://zzz.rettend.me/guide" />

      <Meta name="twitter:title" content="Guide - ZZZ Pull Planner & Tracker" />
      <Meta name="twitter:description" content="How to use the ZZZ Pull Planner to create your pull strategy. Learn about priority lists, luck settings, and safety floors for probability calculations." />

      <div class="mx-auto pb-12 max-w-3xl relative space-y-12">
        <section class="py-12 text-center flex flex-col gap-4">
          <h1 class="text-4xl text-emerald-400 tracking-tight font-bold sm:text-5xl">
            How to Use
          </h1>
          <p class="text-lg text-zinc-400 leading-relaxed mx-auto max-w-2xl">
            Create your pull strategy
          </p>
        </section>

        <section class="flex flex-col gap-8">
          <div class="text-zinc-400 space-y-8">
            {/* Data Persistence */}
            <div class="space-y-8">
              <h3 class="text-xl text-emerald-200 font-semibold mb-2">User Data</h3>
              <p>
                All user data is saved in
                {' '}
                <span class="text-sm text-emerald-400 px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-800/50 inline-block">localStorage</span>
                .
                This means your data is stored locally on your device and is not shared between browsers or devices.
                If you clear your browser's site data, your saved plans and settings will be lost.
              </p>
            </div>

            {/* Inputs */}
            <div class="space-y-8">
              <h3 class="text-xl text-emerald-200 font-semibold mb-4">Inputs</h3>

              <div class="space-y-2">
                <h4 class="text-lg text-emerald-200/80 font-medium mb-2">Priority List</h4>
                <p>
                  Select Agents and W-Engines from the active banners to add them to your priority list.
                  You can
                  {' '}
                  <span class="text-emerald-400">drag and drop</span>
                  {' '}
                  items in the list to reorder them (tap and hold on mobile).
                  <br />
                  The planner strictly follow this order.
                </p>
              </div>

              <div class="space-y-2">
                <h4 class="text-lg text-emerald-200/80 font-medium mb-2">Resources</h4>
                <p>
                  Specify your current available pulls and your expected income. A rough estimate for F2P players is about
                  {' '}
                  <span class="text-emerald-400">100 pulls per month</span>
                  , which is
                  {' '}
                  <span class="text-emerald-400">75 pulls per banner</span>
                  . This assumes you complete everything and includes Residual Signals.
                  <br />
                  You calculate yours.
                  {' '}
                  <span class="text-emerald-400">Income Overview</span>
                  {' '}
                  in the Official HoYoLab app can help.
                </p>
              </div>

              <div class="space-y-2">
                <h4 class="text-lg text-emerald-200/80 font-medium mb-2">Pity & Guarantee</h4>
                <p>
                  Enter your current pity count for both Agents and W-Engines,
                  and toggle the Guaranteed checkbox if your last pull was not from the featured banner.
                  <br />
                  These settings are separate for S-Ranks and A-Ranks.
                </p>
              </div>

              <div class="space-y-2">
                <h4 class="text-lg text-emerald-200/80 font-medium mb-2">Safety Floor</h4>
                <p>
                  Safety floors to change the confidence level of the planner.
                  <br />
                  This is the
                  {' '}
                  <strong><u class="underline-offset-2">primary</u></strong>
                  {' '}
                  way to get a good overview of your chances.
                </p>
                <ul class="mt-2 pl-4 list-inside space-y-1 list-dash">
                  <li>
                    <span class="text-sm text-emerald-400 px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-800/50 inline-block">p50</span>
                    {' '}
                    <strong><u class="underline-offset-2">Median:</u></strong>
                    {' '}
                    Half the time you'll spend more, half the time less. This is a good baseline luck level.
                  </li>
                  <li>
                    <span class="text-sm text-emerald-400 px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-800/50 inline-block">p60</span>
                    {' '}
                    <strong><u class="underline-offset-2">Safe:</u></strong>
                    {' '}
                    Adds a small buffer over median, this is a realistic default.
                  </li>
                  <li>
                    <span class="text-sm text-emerald-400 px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-800/50 inline-block">p75</span>
                    {' '}
                    <strong><u class="underline-offset-2">Very safe:</u></strong>
                    {' '}
                    You have a 75% chance to achieve your target. You can do it!
                  </li>
                  <li>
                    <span class="text-sm text-emerald-400 px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-800/50 inline-block">p90</span>
                    {' '}
                    <strong><u class="underline-offset-2">No surprises:</u></strong>
                    {' '}
                    Absolutely no way to miss this.
                  </li>
                  <li>
                    <span class="text-sm text-emerald-400 px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-800/50 inline-block">EV</span>
                    {' '}
                    <strong><u class="underline-offset-2">Expected Value:</u></strong>
                    {' '}
                    The average cost if you could pull infinite times.
                  </li>
                </ul>
              </div>

              <div class="space-y-2">
                <h4 class="text-lg text-emerald-200/80 font-medium mb-2">Luck Controls</h4>
                <p>
                  These adjust the planner's assumption of luck.
                  <br />
                  This is the
                  {' '}
                  <strong><u class="underline-offset-2">secondary</u></strong>
                  {' '}
                  way to control the probabilities.
                  <br />
                  It's fine to just leave this at
                  {' '}
                  <span class="text-emerald-400">Realistic</span>
                  .
                </p>
                <ul class="mt-2 pl-4 list-disc list-inside space-y-1">
                  <li>
                    <span class="text-emerald-400">Best</span>
                    : Assumes you win every 50/50 and 75/25.
                  </li>
                  <li>
                    <span class="text-emerald-400">Realistic</span>
                    : Uses standard probabilities (50% for Agents, 75% for W-Engines).
                  </li>
                  <li>
                    <span class="text-emerald-400">Worst</span>
                    : Assumes you lose every 50/50 and 75/25.
                  </li>
                </ul>
              </div>
            </div>

            {/* Plan */}
            <div class="space-y-8">
              <h3 class="text-xl text-emerald-200 font-semibold mb-2">Plan</h3>
              <p>
                This shows the calculated results for each banner phase. It displays whether you can afford your targets,
                how many pulls you'll have left (or be short), and the probability of success.
                At the
                {' '}
                <span class="text-emerald-400">Plan Summary</span>
                {' '}
                section it also shows A-Ranks you might get incidentally while pulling for S-Ranks.
              </p>
              <br />
              <p>
                You can toggle between
                {' '}
                <span class="text-emerald-400">Start</span>
                {' '}
                and
                {' '}
                <span class="text-emerald-400">End</span>
                {' '}
                views for each phase.
                {' '}
                <b>Start</b>
                {' '}
                means you wan't to pull as soon as the banner is out, so not considering that phase's income,
                while
                {' '}
                <b>End</b>
                {' '}
                is after income.
              </p>
            </div>

            {/* Pull Simulation */}
            <div class="space-y-2">
              <h3 class="text-xl text-emerald-200 font-semibold mb-2">Pull Simulation</h3>
              <p>
                These are just for convenience: they update Pulls on Hand and Pity counts as you pull in-game,
                without having to manually type in the numbers.
              </p>
            </div>

          </div>
        </section>
      </div>
    </main>
  )
}
