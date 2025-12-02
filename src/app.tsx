// @refresh reload
import { Link, Meta, MetaProvider, Title } from '@solidjs/meta'
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
          <Meta name="description" content="ZZZ Pull Planner and Tracker. Calculate pull probabilities, track your history, simulate pulls, and plan your savings for Zenless Zone Zero." />
          <Meta name="keywords" content="zzz pull planner, zzz pull tracker, zenless zone zero pull calculator, zzz pull simulator, zzz pull history, zzz banner schedule, zzz gacha planner" />
          <Link rel="canonical" href="https://zzz.rettend.me/" />

          <Meta property="og:type" content="website" />
          <Meta property="og:title" content="ZZZ Pull Planner - Calculator & Tracker" />
          <Meta property="og:description" content="Plan your pulls in Zenless Zone Zero. Calculate probabilities, track pity, simulate outcomes, and manage your Polychrome savings." />
          <Meta property="og:url" content="https://zzz.rettend.me/" />
          <Meta property="og:site_name" content="ZZZ Pull Planner" />

          <Meta name="twitter:card" content="summary_large_image" />
          <Meta name="twitter:title" content="ZZZ Pull Planner - Calculator & Tracker" />
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
