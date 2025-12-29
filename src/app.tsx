// @refresh reload
import { AuthProvider } from '@rttnd/gau/client/solid'
import { Meta, MetaProvider } from '@solidjs/meta'
import { createAsync, Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { Suspense } from 'solid-js'
import { getGameData } from '~/remote/game'
import { getProfiles } from '~/remote/profiles'
import { getSession } from '~/server/session'
import { Header } from './components/Header'
import { RootStoreProvider } from './stores'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

export default function App() {
  return (
    <Router
      root={(props) => {
        // Load ALL async data at route level - this is the SSR-safe pattern
        const session = createAsync(() => getSession(), { deferStream: true })
        const gameData = createAsync(() => getGameData(), { deferStream: true })
        const profiles = createAsync(() => getProfiles(), { deferStream: true })

        return (
          <MetaProvider>
            <Meta name="keywords" content="zzz pull planner, zzz pull tracker, zenless zone zero pull calculator, zzz pull simulator, zzz pull history, zzz banner schedule, zzz gacha planner" />
            <Meta property="og:type" content="website" />
            <Meta property="og:site_name" content="ZZZ Pull Planner" />
            <Meta name="twitter:card" content="summary_large_image" />

            <Suspense>
              <AuthProvider session={session}>
                <RootStoreProvider gameData={gameData} profiles={profiles}>
                  <div class="text-emerald-100 font-mono p-6 min-h-screen relative isolate">
                    <Header />
                    {props.children}
                  </div>
                </RootStoreProvider>
              </AuthProvider>
            </Suspense>
          </MetaProvider>
        )
      }}
    >
      <FileRoutes />
    </Router>
  )
}
