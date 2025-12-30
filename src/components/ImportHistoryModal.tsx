import { createSignal, Show } from 'solid-js'
import { usePullHistory } from '~/stores/pullHistory'
import { Button } from './ui/button'
import { Modal } from './ui/modal'

const POWERSHELL_SCRIPT = `[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; Invoke-Expression (New-Object Net.WebClient).DownloadString("https://zzz.rng.moe/scripts/get_signal_link_os.ps1")`

interface ImportHistoryModalProps {
  open: boolean
  onClose: () => void
}

export function ImportHistoryModal(props: ImportHistoryModalProps) {
  const pullHistory = usePullHistory()
  const [url, setUrl] = createSignal('')
  const [copied, setCopied] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [step, setStep] = createSignal<1 | 2>(1)

  const isLoading = () => pullHistory.state().loading

  async function copyScript() {
    await navigator.clipboard.writeText(POWERSHELL_SCRIPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleImport() {
    setError(null)

    if (!url().trim()) {
      setError('Please paste the Search History URL')
      return
    }

    try {
      await pullHistory.importFromUrl(url().trim())
      props.onClose()
      setUrl('')
      setStep(1)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  function handleClose() {
    if (!isLoading()) {
      props.onClose()
      setError(null)
      setUrl('')
      setStep(1)
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={handleClose}
      title={(
        <>
          <i class="i-ph:download-simple-bold text-emerald-400" />
          {' '}
          Import Pull History
        </>
      )}
      maxWidthClass="md:max-w-2xl"
    >
      <div class="p-6 flex flex-col gap-6">
        {/* Step indicators */}
        <div class="flex gap-2 items-center justify-center">
          <button
            onClick={() => setStep(1)}
            class={`text-sm font-bold rounded-full h-8 w-8 transition-colors ${
              step() === 1
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            1
          </button>
          <div class="bg-zinc-700 h-0.5 w-12" />
          <button
            onClick={() => setStep(2)}
            class={`text-sm font-bold rounded-full h-8 w-8 transition-colors ${
              step() === 2
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            2
          </button>
        </div>

        <Show when={step() === 1}>
          {/* Step 1: Copy and run the script */}
          <div class="flex flex-col gap-4">
            <div>
              <h4 class="text-white font-semibold mb-2">Step 1: Run the Script</h4>
              <p class="text-sm text-zinc-400">
                First, open the
                {' '}
                <strong class="text-amber-400">Signal Search</strong>
                {' '}
                (gacha) history in-game.
                Then, open PowerShell and run the following script:
              </p>
            </div>

            <div class="group relative">
              <pre class="text-xs text-zinc-300 font-mono p-4 border border-zinc-800 rounded-lg bg-zinc-950 overflow-x-auto">
                {POWERSHELL_SCRIPT}
              </pre>
              <Button
                onClick={copyScript}
                variant={copied() ? 'green' : 'gray'}
                class={`text-xs right-2 top-2 absolute ${copied() ? '' : 'opacity-0 group-hover:opacity-100'}`}
              >
                {copied() ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            <p class="text-xs text-zinc-500">
              <i class="i-ph:info-bold mr-1" />
              The script will find your Search History URL and copy it to your clipboard.
            </p>

            <Button variant="green" onClick={() => setStep(2)} class="py-3">
              I've run the script
              <i class="i-ph:arrow-right-bold ml-2" />
            </Button>
          </div>
        </Show>

        <Show when={step() === 2}>
          {/* Step 2: Paste the URL */}
          <div class="flex flex-col gap-4">
            <div>
              <h4 class="text-white font-semibold mb-2">Step 2: Paste the URL</h4>
              <p class="text-sm text-zinc-400">
                Paste the Search History URL that was copied to your clipboard:
              </p>
            </div>

            <textarea
              value={url()}
              onInput={e => setUrl(e.currentTarget.value)}
              placeholder="https://public-operation-nap-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?authkey_ver=..."
              class="text-sm text-zinc-300 font-mono p-4 border border-zinc-800 rounded-lg bg-zinc-950 h-24 resize-none placeholder:text-zinc-600 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-emerald-500"
              disabled={isLoading()}
            />

            <Show when={error()}>
              <div class="text-sm text-red-400 p-3 border border-red-500/30 rounded-lg bg-red-500/10 flex gap-2 items-start">
                <i class="i-ph:warning-bold mt-0.5 shrink-0" />
                <span>{error()}</span>
              </div>
            </Show>

            <div class="flex gap-3">
              <Button
                onClick={() => setStep(1)}
                disabled={isLoading()}
                class="py-3 flex-1"
              >
                <i class="i-ph:arrow-left-bold mr-2" />
                Back
              </Button>
              <Button
                variant="green"
                onClick={handleImport}
                disabled={isLoading() || !url().trim()}
                class="py-3 flex flex-1 gap-2 items-center justify-center"
              >
                <Show
                  when={isLoading()}
                  fallback={(
                    <>
                      <i class="i-ph:download-simple-bold" />
                      {' '}
                      Import
                    </>
                  )}
                >
                  <i class="i-ph:spinner-bold animate-spin" />
                  Importing...
                </Show>
              </Button>
            </div>

            <Show when={isLoading()}>
              <div class="text-sm text-zinc-400 p-4 rounded-lg bg-zinc-800/50">
                <p class="mb-2 flex gap-2 items-center">
                  <i class="i-ph:spinner-bold text-emerald-400 animate-spin" />
                  Fetching pull history from all 4 channels...
                </p>
                <p class="text-xs text-zinc-500">
                  This may take a moment due to API rate limits.
                </p>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Modal>
  )
}
