import { createSignal, For, onMount, Show } from 'solid-js'
import bwipjs from 'bwip-js/browser'
import { type ScannedItem, loadByList, taxIn } from '../lib/db'

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
    <div class="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <Show when={props.item.name}>
        <p class="text-sm font-medium text-gray-700 text-center">{props.item.name}</p>
      </Show>
      <canvas ref={canvasRef} class="max-w-full" />
      <p class="font-mono text-xs text-gray-400">{props.item.jan}</p>

      {/* 価格表示 */}
      <Show when={props.item.retailPrice !== undefined || props.item.salePrice !== undefined}>
        <div class="w-full grid grid-cols-2 gap-1 text-center text-xs pt-1 border-t border-gray-100">
          <Show when={props.item.retailPrice !== undefined}>
            <div>
              <p class="text-gray-400">定価</p>
              <p class="font-medium text-gray-700">¥{props.item.retailPrice!.toLocaleString()}</p>
              <p class="text-gray-400">税込 ¥{taxIn(props.item.retailPrice!).toLocaleString()}</p>
            </div>
          </Show>
          <Show when={props.item.salePrice !== undefined}>
            <div>
              <p class="text-gray-400">売価</p>
              <p class="font-medium text-gray-700">¥{props.item.salePrice!.toLocaleString()}</p>
              <p class="text-gray-400">税込 ¥{taxIn(props.item.salePrice!).toLocaleString()}</p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

type Mode = 'db' | 'manual'

export default function Generator(props: { listId: string }) {
  let manualCanvasRef: HTMLCanvasElement | undefined

  const [mode, setMode] = createSignal<Mode>('db')
  const [dbItems, setDbItems] = createSignal<ScannedItem[]>([])
  const [selected, setSelected] = createSignal<Set<string>>(new Set<string>())
  const [generated, setGenerated] = createSignal<ScannedItem[]>([])
  const [loading, setLoading] = createSignal(true)
  const [janCode, setJanCode] = createSignal('')
  const [manualError, setManualError] = createSignal('')

  onMount(async () => {
    setDbItems(await loadByList(props.listId))
    setLoading(false)
  })

  // リスト切り替え時に再ロード
  let prevListId = props.listId
  const reloadIfNeeded = async () => {
    if (props.listId !== prevListId) {
      prevListId = props.listId
      setLoading(true)
      setSelected(new Set<string>())
      setGenerated([])
      setDbItems(await loadByList(props.listId))
      setLoading(false)
    }
  }

  function toggleSelect(id: string) {
    const next = new Set<string>(selected())
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    const ids = dbItems().map((i) => i.id)
    setSelected(selected().size === ids.length ? new Set<string>() : new Set<string>(ids))
  }

  async function generateFromDB() {
    await reloadIfNeeded()
    setGenerated(dbItems().filter((i) => selected().has(i.id)))
  }

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

      {/* モード切替 */}
      <div class="flex overflow-hidden rounded-xl border border-gray-200 text-sm font-medium">
        <button
          onClick={() => setMode('db')}
          class={`flex-1 py-2 transition-colors ${mode() === 'db' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}
        >DBから生成</button>
        <button
          onClick={() => setMode('manual')}
          class={`flex-1 py-2 transition-colors ${mode() === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}
        >手動入力</button>
      </div>

      {/* DB モード */}
      <Show when={mode() === 'db'}>
        <Show when={loading()}>
          <p class="text-center text-sm text-gray-400">読み込み中...</p>
        </Show>
        <Show when={!loading() && dbItems().length === 0}>
          <p class="text-center text-sm text-gray-400">
            このリストにアイテムがありません。<br />スキャンタブで読み取ってください。
          </p>
        </Show>
        <Show when={!loading() && dbItems().length > 0}>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-500">{selected().size} 件選択中</span>
            <button onClick={toggleAll} class="text-sm text-blue-600">
              {allSelected() ? '全解除' : '全選択'}
            </button>
          </div>

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
                    <p class="font-mono text-sm font-bold text-gray-800">{item.jan}</p>
                    <Show when={item.name}>
                      <p class="text-xs text-gray-500 truncate">{item.name}</p>
                    </Show>
                    <Show when={item.retailPrice !== undefined || item.salePrice !== undefined}>
                      <p class="text-xs text-gray-400">
                        {item.retailPrice !== undefined && `定価¥${item.retailPrice.toLocaleString()}`}
                        {item.retailPrice !== undefined && item.salePrice !== undefined && '　'}
                        {item.salePrice !== undefined && `売価¥${item.salePrice.toLocaleString()}`}
                      </p>
                    </Show>
                  </div>
                </label>
              )}
            </For>
          </div>

          <button
            onClick={generateFromDB}
            disabled={selected().size === 0}
            class="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            選択した {selected().size} 件のバーコードを生成
          </button>

          <Show when={generated().length > 0}>
            <div class="flex flex-col gap-3 mt-2">
              <h3 class="text-sm font-semibold text-gray-500">生成結果</h3>
              <For each={generated()}>
                {(item) => <BarcodeCard item={item} />}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      {/* 手動入力モード */}
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
          <button onClick={generateManual} class="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white">
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
