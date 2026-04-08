import { createSignal, For, onMount, Show } from 'solid-js'
import bwipjs from 'bwip-js/browser'
import { type ScannedItem, loadAll } from '../lib/db'

// 個別バーコードカード（Canvasはマウント時に描画）
function BarcodeCard(props: { item: ScannedItem }) {
  let canvasRef: HTMLCanvasElement | undefined

  onMount(() => {
    if (!canvasRef) return
    try {
      bwipjs.toCanvas(canvasRef, {
        bcid: props.item.jan.length === 13 ? 'ean13' : 'ean8',
        text: props.item.jan,
        scale: 3,
        height: 18,
        includetext: true,
        textxalign: 'center',
      })
    } catch { /* 無効なJANは無視 */ }
  })

  return (
    <div class="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {props.item.name && (
        <p class="text-sm font-medium text-gray-700 text-center">{props.item.name}</p>
      )}
      <canvas ref={canvasRef} class="max-w-full" />
      <p class="font-mono text-xs text-gray-400">{props.item.jan}</p>
    </div>
  )
}

type Mode = 'db' | 'manual'

export default function Generator() {
  let manualCanvasRef: HTMLCanvasElement | undefined

  const [mode, setMode] = createSignal<Mode>('db')

  // DB モード
  const [dbItems, setDbItems] = createSignal<ScannedItem[]>([])
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [generated, setGenerated] = createSignal<ScannedItem[]>([])
  const [loading, setLoading] = createSignal(true)

  // 手動入力モード
  const [janCode, setJanCode] = createSignal('')
  const [manualError, setManualError] = createSignal('')

  onMount(async () => {
    setDbItems(await loadAll())
    setLoading(false)
  })

  // ── DB モード ────────────────────────────────────────────

  function toggleSelect(id: string) {
    const next = new Set<string>(selected())
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    const ids = dbItems().map((i) => i.id)
    if (selected().size === ids.length) {
      setSelected(new Set<string>())
    } else {
      setSelected(new Set<string>(ids))
    }
  }

  function generateFromDB() {
    const targets = dbItems().filter((i) => selected().has(i.id))
    setGenerated(targets)
  }

  // ── 手動入力モード ───────────────────────────────────────

  function generateManual() {
    const code = janCode().trim()
    setManualError('')
    if (!/^\d{8}$|^\d{13}$/.test(code)) {
      setManualError('8桁または13桁の数字で入力してください')
      return
    }
    try {
      bwipjs.toCanvas(manualCanvasRef!, {
        bcid: code.length === 13 ? 'ean13' : 'ean8',
        text: code,
        scale: 3,
        height: 18,
        includetext: true,
        textxalign: 'center',
      })
    } catch (e) {
      setManualError('生成に失敗しました: ' + (e as Error).message)
    }
  }

  const allSelected = () => dbItems().length > 0 && selected().size === dbItems().length

  return (
    <div class="flex flex-col gap-4 p-4">
      <h2 class="text-center text-xl font-bold">JANコード生成</h2>

      {/* モード切り替えタブ */}
      <div class="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-medium">
        <button
          onClick={() => setMode('db')}
          class={`flex-1 py-2 transition-colors ${mode() === 'db' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}
        >
          DBから生成
        </button>
        <button
          onClick={() => setMode('manual')}
          class={`flex-1 py-2 transition-colors ${mode() === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}
        >
          手動入力
        </button>
      </div>

      {/* ── DB モード ── */}
      <Show when={mode() === 'db'}>
        <Show when={loading()}>
          <p class="text-center text-sm text-gray-400">読み込み中...</p>
        </Show>

        <Show when={!loading() && dbItems().length === 0}>
          <p class="text-center text-sm text-gray-400">
            スキャン履歴がありません。<br />まずスキャンタブでJANコードを読み取ってください。
          </p>
        </Show>

        <Show when={!loading() && dbItems().length > 0}>
          {/* 全選択 */}
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-500">{selected().size} 件選択中</span>
            <button
              onClick={toggleAll}
              class="text-sm text-blue-600"
            >
              {allSelected() ? '全解除' : '全選択'}
            </button>
          </div>

          {/* アイテム一覧 */}
          <div class="flex flex-col gap-2">
            <For each={dbItems()}>
              {(item) => (
                <label class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected().has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    class="h-4 w-4 accent-blue-600"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="font-mono text-sm font-bold text-gray-800 truncate">{item.jan}</p>
                    {item.name && (
                      <p class="text-xs text-gray-500 truncate">{item.name}</p>
                    )}
                  </div>
                </label>
              )}
            </For>
          </div>

          {/* 生成ボタン */}
          <button
            onClick={generateFromDB}
            disabled={selected().size === 0}
            class="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            選択した {selected().size} 件のバーコードを生成
          </button>

          {/* 生成結果 */}
          <Show when={generated().length > 0}>
            <div class="mt-2 flex flex-col gap-3">
              <h3 class="text-sm font-semibold text-gray-500">生成結果</h3>
              <For each={generated()}>
                {(item) => <BarcodeCard item={item} />}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      {/* ── 手動入力モード ── */}
      <Show when={mode() === 'manual'}>
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-600">JANコード（8桁 or 13桁）</label>
            <input
              type="text"
              inputmode="numeric"
              value={janCode()}
              onInput={(e) => setJanCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 13))}
              onKeyDown={(e) => e.key === 'Enter' && generateManual()}
              placeholder="例: 4901234567890"
              class="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-mono text-base focus:border-blue-500 focus:outline-none"
              maxLength={13}
            />
          </div>

          {manualError() && <p class="text-sm text-red-500">{manualError()}</p>}

          <button
            onClick={generateManual}
            class="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white"
          >
            生成
          </button>

          <div class="flex min-h-28 items-center justify-center rounded-xl border border-gray-200 bg-white p-4">
            <canvas ref={manualCanvasRef} />
          </div>
        </div>
      </Show>
    </div>
  )
}
