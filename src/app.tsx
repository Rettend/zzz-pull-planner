// @refresh reload
import { Meta, MetaProvider } from '@solidjs/meta'
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { Suspense } from 'solid-js'
import { Header } from './components/Header'
import { RootStoreProvider } from './stores'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

export default function App() {
  return (
    <Router
      root={props => (
        <MetaProvider>
          <Meta name="keywords" content="zzz pull planner, zzz pull tracker, zenless zone zero pull calculator, zzz pull simulator, zzz pull history, zzz banner schedule, zzz gacha planner" />
          <Meta property="og:type" content="website" />
          <Meta property="og:site_name" content="ZZZ Pull Planner" />
          <Meta name="twitter:card" content="summary_large_image" />

          <Suspense>
            <RootStoreProvider>
              <div class="text-emerald-100 font-mono p-6 min-h-screen relative isolate">
                <Header />
                {props.children}
              </div>
            </RootStoreProvider>
          </Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
