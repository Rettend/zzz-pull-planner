import { ExternalLink } from '~/components/ExternalLink'

export function Header() {
  return (
    <header class="text-sm text-zinc-400 mb-6 pb-6 border-b border-zinc-800">
      <div class="mx-auto flex flex-row gap-3 max-w-7xl items-center justify-between">
        <div class="flex flex-col gap-1 sm:flex-row sm:gap-4 sm:items-center">
          <span class="text-xs text-zinc-500 tracking-0.2em uppercase">ZZZ Pull Planner</span>
          <span class="text-zinc-700 hidden sm:inline">|</span>
          <ExternalLink
            href="https://rettend.me"
            class="text-xs text-zinc-500"
          >
            Made by Rettend
          </ExternalLink>
        </div>
        <div class="flex gap-4 items-center">
          <ExternalLink
            href="https://discord.gg/FvVaUPhj3t"
            class="text-zinc-400"
            title="Join Discord"
          >
            <i class="i-ph:discord-logo text-xl" />
          </ExternalLink>
          <ExternalLink
            href="https://github.com/Rettend/zzz-pull-planner"
            class="text-zinc-400"
            title="View the project on GitHub"
          >
            <i class="i-ph:github-logo text-xl" />
          </ExternalLink>
        </div>
      </div>
    </header>
  )
}
