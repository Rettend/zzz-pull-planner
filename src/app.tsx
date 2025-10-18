// @refresh reload
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { Suspense } from 'solid-js'
import { RootStoreProvider } from './stores'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

export default function App() {
  return (
    <Router
      root={props => (
        <Suspense>
          <RootStoreProvider>{props.children}</RootStoreProvider>
        </Suspense>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
