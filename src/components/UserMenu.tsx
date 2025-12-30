import type { Provider } from '~/lib/auth'
import { useAction } from '@solidjs/router'
import { createMemo, createSignal, Show } from 'solid-js'
import { SignInDropdown } from '~/components/SignInDropdown'
import { Button } from '~/components/ui/button'
import { Modal } from '~/components/ui/modal'
import { useAuth } from '~/lib/auth'
import { stashDraftOAuthImport } from '~/lib/draft-oauth'
import { deleteAccount } from '~/remote/account'
import { useProfilesStore } from '~/stores/profiles'

export function UserMenu() {
  const auth = useAuth()
  const [profilesState] = useProfilesStore()
  const [isOpen, setIsOpen] = createSignal(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  const doDeleteAccount = useAction(deleteAccount)

  const user = createMemo(() => auth.session()?.user)
  const linkedProviders = createMemo(() => {
    const accounts = auth.session()?.accounts ?? []
    return new Set((accounts ?? []).map(a => a.provider))
  })
  const isGuest = createMemo(() => {
    const s = auth.session()
    const claimGuest = (s?.session as any)?.isGuest === true
    const hasLinks = (s?.accounts?.length ?? 0) > 0
    return claimGuest && !hasLinks
  })
  const displayName = createMemo(() => {
    if (isGuest())
      return 'Guest'
    return user()?.name ?? 'User'
  })
  const isLoading = () => auth.isLoading()

  function handleLink(provider: Provider) {
    auth.linkAccount(provider)
    setIsOpen(false)
  }

  function handleSignOut() {
    auth.signOut()
    setIsOpen(false)
  }

  async function confirmDeleteGuest() {
    if (deleting())
      return
    setDeleting(true)
    try {
      await doDeleteAccount({ type: 'guest' })
    }
    finally {
      await auth.signOut()
      setDeleting(false)
      setShowDeleteConfirm(false)
      setIsOpen(false)
    }
  }

  // Close dropdown when clicking outside
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('[data-user-menu]'))
      setIsOpen(false)
  }

  // Add/remove click listener based on dropdown state
  function toggleDropdown() {
    const newState = !isOpen()
    setIsOpen(newState)

    if (newState)
      setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
    else
      document.removeEventListener('click', handleClickOutside)
  }

  return (
    <div class="relative" data-user-menu>
      <Modal
        open={showDeleteConfirm()}
        onClose={() => (deleting() ? null : setShowDeleteConfirm(false))}
        title="Delete account?"
        maxWidthClass="md:max-w-md"
      >
        <div class="p-4 bg-zinc-950/50 flex flex-col gap-4">
          <div class="text-sm text-zinc-300">
            This will permanently delete your
            {' '}
            <span class="text-zinc-100 font-semibold">Guest</span>
            {' '}
            account and all saved profiles.
            If you want to keep it, connect Google/Discord instead.
          </div>
          <div class="flex gap-2 justify-end">
            <Button
              variant="gray"
              disabled={deleting()}
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="red"
              disabled={deleting()}
              onClick={confirmDeleteGuest}
              class="inline-flex gap-2 items-center"
            >
              <Show when={deleting()} fallback={<i class="i-ph:trash-bold size-4" />}>
                <i class="i-gg:spinner size-4 animate-spin" />
              </Show>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Show
        when={!isLoading()}
        fallback={(
          <div class="border border-zinc-700 rounded-lg bg-zinc-800/50 flex h-9 w-24 items-center justify-center animate-pulse">
            <i class="i-gg:spinner text-zinc-500 animate-spin" />
          </div>
        )}
      >
        <Show
          when={user()}
          fallback={(
            <SignInDropdown
              disabled={isLoading()}
              onBeforeSignIn={() => {
                // If user starts OAuth while in draft mode, stash the draft in sessionStorage so we can import it after redirect.
                stashDraftOAuthImport({
                  name: profilesState.draft.name,
                  targets: profilesState.draft.targets,
                })
              }}
            />
          )}
        >
          {/* User Avatar Button */}
          <button
            onClick={toggleDropdown}
            class="p-1 pr-3 border border-zinc-700 rounded-lg bg-zinc-800/50 flex gap-2 transition-colors items-center hover:border-emerald-500/50"
          >
            <Show
              when={user()?.image}
              fallback={(
                <div class="border border-zinc-600 rounded-md bg-zinc-700 flex h-7 w-7 items-center justify-center">
                  <i class="i-ph:user-bold text-sm text-zinc-400" />
                </div>
              )}
            >
              <img
                src={user()?.image ?? ''}
                alt={displayName()}
                class="border border-zinc-600 rounded-md h-7 w-7 object-cover"
              />
            </Show>
            <span class="text-sm text-zinc-300 max-w-24 truncate">{displayName()}</span>
            <i class={`i-ph:caret-down text-xs text-zinc-500 transition-transform ${isOpen() ? 'rotate-180' : ''}`} />
          </button>
        </Show>
      </Show>

      {/* Dropdown Menu */}
      <Show when={isOpen() && user()}>
        <div class="mt-2 border border-zinc-700 rounded-lg bg-zinc-900 w-48 shadow-xl right-0 absolute z-50 overflow-hidden">
          {/* User Menu */}
          <div class="p-2 border-b border-zinc-800">
            <div class="text-sm text-zinc-300 px-2 py-1 truncate">{displayName()}</div>
            <Show when={!isGuest()}>
              <div class="text-xs text-zinc-500 px-2 truncate">{user()?.email}</div>
            </Show>
          </div>
          <div class="p-2">
            {/* Connect Providers (for guests or users who want additional links) */}
            <Show when={!linkedProviders().has('google') || !linkedProviders().has('discord')}>
              <div class="text-xs text-zinc-500 font-medium px-2 py-1.5">Connect account</div>
              <div class="mb-2 space-y-1">
                <Show when={!linkedProviders().has('google')}>
                  <button
                    onClick={() => handleLink('google')}
                    class="text-sm text-zinc-300 px-3 py-2 rounded-md flex gap-3 w-full transition-colors items-center hover:text-white hover:bg-zinc-800"
                  >
                    <i class="i-ph:google-logo text-lg" />
                    Google
                  </button>
                </Show>
                <Show when={!linkedProviders().has('discord')}>
                  <button
                    onClick={() => handleLink('discord')}
                    class="text-sm text-zinc-300 px-3 py-2 rounded-md flex gap-3 w-full transition-colors items-center hover:text-white hover:bg-zinc-800"
                  >
                    <i class="i-ph:discord-logo text-lg" />
                    Discord
                  </button>
                </Show>
              </div>
            </Show>
            <Show
              when={isGuest()}
              fallback={(
                <button
                  onClick={handleSignOut}
                  class="text-sm text-red-400 px-3 py-2 rounded-md flex gap-3 w-full transition-colors items-center hover:text-red-300 hover:bg-zinc-800"
                >
                  <i class="i-ph:sign-out-bold text-lg" />
                  Sign Out
                </button>
              )}
            >
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowDeleteConfirm(true)
                }}
                class="text-sm text-red-400 px-3 py-2 rounded-md flex gap-3 w-full transition-colors items-center hover:text-red-300 hover:bg-zinc-800"
                title="Guest accounts are only recoverable via this browser session cookie."
              >
                <i class="i-ph:trash-bold text-lg" />
                Delete Account
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
