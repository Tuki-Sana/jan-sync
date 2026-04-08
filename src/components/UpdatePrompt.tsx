import { Show } from 'solid-js'
import { useRegisterSW } from 'virtual:pwa-register/solid'

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  return (
    <Show when={needRefresh()}>
      <div class="fixed bottom-[max(1rem,env(safe-area-inset-bottom,1rem))] inset-x-4 z-50 mx-auto max-w-lg">
        <div class="flex items-center justify-between gap-3 rounded-2xl bg-slate-800 px-4 py-3 shadow-2xl ring-1 ring-white/10">
          <p class="text-sm text-white">新しいバージョンがあります</p>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            class="shrink-0 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white active:bg-blue-400 touch-manipulation"
          >
            更新する
          </button>
        </div>
      </div>
    </Show>
  )
}
