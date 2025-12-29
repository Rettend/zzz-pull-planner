import type { ProfileTarget } from '~/stores/profiles'
import { createMemo } from 'solid-js'
import { SignInDropdown } from '~/components/SignInDropdown'
import { Button } from '~/components/ui/button'
import { stashDraftOAuthImport } from '~/lib/draft-oauth'
import { useProfilesStore } from '~/stores/profiles'

export function SavePlanBanner(props: {
  loading: boolean
  onSave: () => void | Promise<void>
  onDismiss: () => void
}) {
  const [profilesState] = useProfilesStore()

  const draftName = createMemo(() => profilesState.draft.name)
  const draftTargets = createMemo<ProfileTarget[]>(() => profilesState.draft.targets)

  return (
    <section class="animate-slide-down p-3 border border-emerald-700/50 rounded-xl bg-emerald-900/20 flex gap-3 items-center justify-between">
      <div class="flex gap-3 items-start">
        <i class="i-ph:cloud-arrow-up-bold text-emerald-300 mt-0.5 shrink-0 size-5" />
        <div class="text-sm text-zinc-300">
          <div class="text-emerald-300 font-semibold">Save your plan</div>
          <div class="text-zinc-400">
            Create a profile to keep your plan. Sign in with Google/Discord to sync across devices.
          </div>
        </div>
      </div>

      <div class="flex shrink-0 gap-2 items-center">
        <Button
          variant="darkGreen"
          disabled={props.loading}
          onClick={() => props.onSave()}
          class="inline-flex gap-2 items-center"
          title="Creates a profile and saves your current plan (no OAuth required)."
        >
          <i class="i-ph:floppy-disk-bold size-4" />
          Save Plan
        </Button>

        <SignInDropdown
          disabled={props.loading}
          buttonClass="px-3 py-1.5 border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-emerald-500 bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/40 inline-flex gap-2 items-center"
          label="Sign In"
          onBeforeSignIn={() => {
            stashDraftOAuthImport({
              name: draftName(),
              targets: draftTargets(),
            })
          }}
        />

        <button
          class="text-zinc-500 p-2 transition-colors hover:text-zinc-200"
          onClick={() => props.onDismiss()}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <i class="i-ph:x-bold text-lg" />
        </button>
      </div>
    </section>
  )
}
