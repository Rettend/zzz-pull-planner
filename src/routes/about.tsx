import { Link, Meta, Title } from '@solidjs/meta'
import { ExternalLink } from '~/components/ExternalLink'

export default function About() {
  return (
    <main class="text-emerald-100 font-mono">
      <Title>About - ZZZ Pull Planner & Tracker</Title>
      <Meta name="description" content="Learn more about ZZZ Pull Planner, a tool for planning your Zenless Zone Zero pulls. It's automatically updated and can calculate your chances." />
      <Link rel="canonical" href="https://zzz.rettend.me/about" />

      <Meta property="og:title" content="About - ZZZ Pull Planner & Tracker" />
      <Meta property="og:description" content="Learn more about ZZZ Pull Planner, a tool for planning your Zenless Zone Zero pulls. It's automatically updated and can calculate your chances." />
      <Meta property="og:url" content="https://zzz.rettend.me/about" />

      <Meta name="twitter:title" content="About - ZZZ Pull Planner & Tracker" />
      <Meta name="twitter:description" content="Learn more about ZZZ Pull Planner, a tool for planning your Zenless Zone Zero pulls. It's automatically updated and can calculate your chances." />

      <div class="mx-auto pb-12 max-w-3xl relative space-y-12">
        {/* Title Section */}
        <section class="py-12 text-center flex flex-col gap-4">
          <h1 class="text-4xl text-emerald-400 tracking-tight font-bold sm:text-5xl">
            ZZZ Pull Planner
          </h1>
          <p class="text-lg text-zinc-400 leading-relaxed mx-auto max-w-2xl">
            Planner, Tracker, and Calculator for Zenless Zone Zero
          </p>
        </section>

        {/* Features */}
        <section class="flex flex-col gap-8">
          <h2 class="text-2xl text-emerald-300 font-bold pb-2 border-b border-zinc-800">Features</h2>

          <div class="text-zinc-400 gap-8 grid sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <h3 class="text-lg text-emerald-200 font-semibold">Smart Planning</h3>
              <p>
                View current and upcoming banners, and prioritize your targets.
                The planner automatically calculates your chances based on your resources, expected income, and luck settings.
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <h3 class="text-lg text-emerald-200 font-semibold">Detailed Breakdown</h3>
              <p>
                Supports Mindscapes for both S-Ranks and A-Ranks.
                See cost breakdowns with numbers, and also visualized with a nice progress bar.
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <h3 class="text-lg text-emerald-200 font-semibold">Probability-based</h3>
              <p>
                See your success rates with different safety floors (p50, p75, p90, etc.) which show different risk levels.
                Adjust your luck to see the best and worst cases.
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <h3 class="text-lg text-emerald-200 font-semibold">Automated but Local</h3>
              <p>
                All user data is stored locally in the browser, no account required.
                <br />
                Game data is automatically updated from the ZZZ Fandom Wiki.
              </p>
            </div>
          </div>
        </section>

        {/* Credits */}
        <section class="flex flex-col gap-4">
          <h2 class="text-2xl text-emerald-300 font-bold pb-2 border-b border-zinc-800">Credits</h2>
          <ul class="text-zinc-400 space-y-2">
            <li class="flex items-start">
              <div>
                Banner data and images are sourced from the
                {' '}
                <ExternalLink href="https://zenless-zone-zero.fandom.com/" class="text-emerald-400 underline underline-offset-2">ZZZ Fandom Wiki</ExternalLink>
                , license:
                {' '}
                <ExternalLink href="https://creativecommons.org/licenses/by-sa/3.0/" class="text-emerald-400 underline underline-offset-2">CC-BY-SA</ExternalLink>
              </div>
            </li>
            <li class="flex gap-3 items-start">
              <div>
                Source code available on
                {' '}
                <ExternalLink href="https://github.com/Rettend/zzz-pull-planner" class="text-emerald-400 underline underline-offset-2">GitHub</ExternalLink>
                , license: MIT
              </div>
            </li>
            <li class="flex gap-3 items-start">
              <div>
                I have a
                {' '}
                <ExternalLink href="https://discord.gg/FvVaUPhj3t" class="text-emerald-400 underline underline-offset-2">Discord</ExternalLink>
                {' '}
                server, any feedback is welcome!
              </div>
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
