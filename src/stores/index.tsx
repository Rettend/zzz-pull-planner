import type { ParentProps } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { AccountsStoreProvider, useAccountsStore } from './accounts'
import { GameDataProvider } from './game'
import { TargetsStoreProvider } from './targets'
import { UIStoreProvider } from './ui'

export function RootStoreProvider(props: ParentProps) {
  return (
    <GameDataProvider>
      <AccountsStoreProvider>
        <AccountScopedProviders>
          {props.children}
        </AccountScopedProviders>
      </AccountsStoreProvider>
    </GameDataProvider>
  )
}

function AccountScopedProviders(props: ParentProps) {
  const [accounts] = useAccountsStore()
  const accountId = createMemo(() => accounts.currentId)
  return (
    <Show when={accountId()} keyed>
      {id => (
        <UIStoreProvider accountId={id}>
          <TargetsStoreProvider accountId={id}>
            {props.children}
          </TargetsStoreProvider>
        </UIStoreProvider>
      )}
    </Show>
  )
}
