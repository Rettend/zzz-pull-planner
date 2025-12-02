import { Title } from '@solidjs/meta'
import { HttpStatusCode } from '@solidjs/start'

export default function NotFound() {
  return (
    <>
      <Title>Not Found - ZZZ Pull Planner & Tracker</Title>
      <HttpStatusCode code={404} />
      <main class="text-zinc-200 p-4 flex flex-col min-h-[50vh] items-center justify-center">
        <h1 class="text-6xl text-emerald-500 font-bold mb-4">404</h1>
        <p class="text-xl text-zinc-400">Page not found</p>
      </main>
    </>
  )
}
