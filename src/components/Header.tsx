import { A } from '@solidjs/router'
import { ExternalLink } from '~/components/ExternalLink'
import { NavBar } from '~/components/NavBar'

export function Header() {
  return (
    <header class="text-sm text-zinc-400 mb-6 pb-6 border-b border-zinc-800">
      <div class="mx-auto flex flex-row gap-4 max-w-7xl justify-between">
        {/* Left Column: Title + Made by + Socials */}
        <div class="flex flex-col gap-3 items-start md:flex-row md:gap-4 md:items-center">
          <A href="/" class="text-xs text-zinc-500 tracking-0.2em uppercase transition-colors hover:text-emerald-300">ZZZ Pull Planner</A>
          <span class="text-zinc-700 hidden md:inline">|</span>
          <ExternalLink
            href="https://rettend.me"
            class="text-xs text-zinc-500"
          >
            Made by Rettend
          </ExternalLink>
          <span class="text-zinc-700 hidden md:inline">|</span>

          <div class="flex gap-4 items-center">
            <ExternalLink
              href="https://discord.gg/FvVaUPhj3t"
              class="text-zinc-500"
              title="Join Discord"
            >
              <i class="i-ph:discord-logo text-xl" />
            </ExternalLink>
            <ExternalLink
              href="https://github.com/Rettend/zzz-pull-planner"
              class="text-zinc-500"
              title="View the project on GitHub"
            >
              <i class="i-ph:github-logo text-xl" />
            </ExternalLink>
          </div>
        </div>

        {/* Right Column: NavBar */}
        <div class="pt-1 flex items-start md:pt-0 md:items-center">
          <NavBar />
        </div>
      </div>
    </header>
  )
}
