// @refresh reload
import { Meta, MetaProvider, Title } from '@solidjs/meta'
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
          <Title>ZZZ Pull Planner</Title>
          <Meta name="description" content="Plan pulls in Zenless Zone Zero. Calculate probabilities, manage resources, and track your pity." />

          <Meta property="og:type" content="website" />
          <Meta property="og:title" content="ZZZ Pull Planner" />
          <Meta property="og:description" content="Plan pulls in Zenless Zone Zero. Calculate probabilities, manage resources, and track your pity." />

          <Meta name="twitter:card" content="summary_large_image" />
          <Meta name="twitter:title" content="ZZZ Pull Planner" />
          <Meta name="twitter:description" content="Plan pulls in Zenless Zone Zero. Calculate probabilities, manage resources, and track your pity." />

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
