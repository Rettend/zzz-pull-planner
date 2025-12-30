import { createMemo, createSignal, For, Show } from 'solid-js'
import { useProfilesStore } from '~/stores/profiles'

export function ProfilesTabs() {
  const [state, actions] = useProfilesStore()
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editingValue, setEditingValue] = createSignal('')
  const isBusy = createMemo(() => state.loading || state.fetchingProfiles)

  function startEdit(id: string, name: string) {
    setEditingId(id)
    setEditingValue(name)
  }

  function submitEdit() {
    const id = editingId()
    if (!id)
      return

    const name = editingValue().trim()
    if (name.length === 0)
      actions.deleteProfile(id)
    else
      actions.renameProfile(id, name)

    setEditingId(null)
  }

  async function onAdd() {
    if (isBusy())
      return
    const name = state.profiles.length === 0 ? 'My Plan' : `Profile ${state.profiles.length + 1}`
    await actions.addProfile(name)
  }

  return (
    <div class="flex gap-2 items-center overflow-x-auto">
      <For each={state.profiles}>
        {profile => (
          <Show
            when={editingId() === profile.id}
            fallback={(
              <button
                class={`group px-2 py-1 border rounded-md inline-flex gap-2 w-32 items-start ${state.currentProfileId === profile.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-emerald-500/60'}`}
                onClick={() => actions.selectProfile(profile.id)}
                title={profile.name}
              >
                <span class={`${state.currentProfileId === profile.id ? 'text-emerald-200' : 'text-zinc-200'} w-28 truncate`}>{profile.name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  class="text-zinc-300 ml-auto opacity-0 cursor-pointer transition-opacity hover:text-emerald-300 group-hover:opacity-100"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation()
                    startEdit(profile.id, profile.name)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      startEdit(profile.id, profile.name)
                    }
                  }}
                >
                  <i class="i-ph:pencil-simple-duotone" />
                </span>
              </button>
            )}
          >
            <div
              class={`px-2 py-1 border rounded-md inline-flex gap-2 w-32 items-start ${state.currentProfileId === profile.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-zinc-900 border-zinc-700 text-zinc-300'}`}
              title={profile.name}
            >
              <input
                class={`outline-none bg-transparent ${state.currentProfileId === profile.id ? 'text-emerald-200' : 'text-zinc-200'}`}
                value={editingValue()}
                ref={(el) => {
                  setTimeout(() => {
                    el?.focus()
                    el?.select()
                  }, 0)
                }}
                onInput={e => setEditingValue(e.currentTarget.value)}
                onBlur={() => submitEdit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitEdit()
                  }
                }}
              />
            </div>
          </Show>
        )}
      </For>
      <button
        class={`group text-zinc-200 px-2 py-1 border border-zinc-700 rounded-md bg-zinc-900 transition-colors ${isBusy() ? 'opacity-60 cursor-not-allowed' : 'hover:border-emerald-500/60'}`}
        onClick={onAdd}
        title="Add profile"
        disabled={isBusy()}
      >
        <Show
          when={isBusy()}
          fallback={<i class="i-ph:plus-bold transition-colors group-hover:text-emerald-300" />}
        >
          <i class="i-gg:spinner text-zinc-300 size-4 animate-spin" />
        </Show>
      </button>
    </div>
  )
}
