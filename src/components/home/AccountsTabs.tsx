import { createSignal, For, Show } from 'solid-js'
import { useAccountsStore } from '~/stores/accounts'

export function AccountsTabs() {
  const [accounts, accountActions] = useAccountsStore()
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editingValue, setEditingValue] = createSignal('')

  function startEditAccount(id: string, name: string) {
    setEditingId(id)
    setEditingValue(name)
  }

  function submitEditAccount() {
    const id = editingId()
    if (!id)
      return
    const name = editingValue().trim()
    if (name.length === 0)
      accountActions.remove(id)
    else
      accountActions.rename(id, name)
    setEditingId(null)
  }

  function onAddAccount() {
    accountActions.add()
  }

  return (
    <div class="flex gap-2 items-center overflow-x-auto">
      <For each={accounts.accounts}>
        {acc => (
          <Show
            when={editingId() === acc.id}
            fallback={(
              <button
                class={`group px-2 py-1 border rounded-md inline-flex gap-2 w-32 items-start ${accounts.currentId === acc.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-emerald-500/60'}`}
                onClick={() => accountActions.select(acc.id)}
                title={acc.name}
              >
                <span class={`${accounts.currentId === acc.id ? 'text-emerald-200' : 'text-zinc-200'} w-28 truncate`}>{acc.name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  class="text-zinc-300 ml-auto opacity-0 cursor-pointer transition-opacity hover:text-emerald-300 group-hover:opacity-100"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation()
                    startEditAccount(acc.id, acc.name)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      startEditAccount(acc.id, acc.name)
                    }
                  }}
                >
                  <i class="i-ph:pencil-simple-duotone" />
                </span>
              </button>
            )}
          >
            <div
              class={`px-2 py-1 border rounded-md inline-flex gap-2 w-32 items-start ${accounts.currentId === acc.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-zinc-900 border-zinc-700 text-zinc-300'}`}
              title={acc.name}
            >
              <input
                class={`outline-none bg-transparent ${accounts.currentId === acc.id ? 'text-emerald-200' : 'text-zinc-200'}`}
                value={editingValue()}
                ref={(el) => {
                  setTimeout(() => {
                    el?.focus()
                    el?.select()
                  }, 0)
                }}
                onInput={e => setEditingValue(e.currentTarget.value)}
                onBlur={() => submitEditAccount()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitEditAccount()
                  }
                }}
              />
            </div>
          </Show>
        )}
      </For>
      <button
        class="text-zinc-200 px-2 py-1 border border-zinc-700 rounded-md bg-zinc-900 hover:border-emerald-500/60"
        onClick={onAddAccount}
        title="Add account"
      >
        <i class="i-ph:plus-bold" />
      </button>
    </div>
  )
}
