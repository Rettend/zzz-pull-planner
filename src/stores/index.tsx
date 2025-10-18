import type { ParentProps } from 'solid-js'
import { TargetsStoreProvider } from './targets'
import { UIStoreProvider } from './ui'

export function RootStoreProvider(props: ParentProps) {
  return (
    <UIStoreProvider>
      <TargetsStoreProvider>
        {props.children}
      </TargetsStoreProvider>
    </UIStoreProvider>
  )
}
