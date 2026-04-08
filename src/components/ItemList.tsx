import { createSignal, For, onMount, Show, createMemo } from 'solid-js'
import { type ScannedItem, type JanList, loadAllItems, removeItem, taxIn } from '../lib/db'

export default function ItemList(props: { lists: JanList[] }) {
  const [items, setItems] = createSignal<ScannedItem[]>([])
  const [query, setQuery] = createSignal('')
  const [loading, setLoading] = createSignal(true)

  onMount(async () => {
    setItems(await loadAllItems())
    setLoading(false)
  })

  const listMap = createMemo(() =>
    Object.fromEntries(props.lists.map((l) => [l.id, l.name]))
  )

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase()
    if (!q) return items()
    return items().filter(
      (i) => i.jan.includes(q) || i.name.toLowerCase().includes(q)
    )
  })

  // リストごとにグループ化
  const grouped = createMemo(() => {
    const map = new Map<string, ScannedItem[]>()
    for (const item of filtered()) {
      const list = map.get(item.listId) ?? []
      list.push(item)
      map.set(item.listId, list)
    }
    // リスト作成順に並べる
    return props.lists
      .map((l) => ({ list: l, items: map.get(l.id) ?? [] }))
      .filter((g) => g.items.length > 0)
  })

  async function deleteOne(id: string) {
    await removeItem(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const totalCount = () => items().length

  return (
    <div class="flex flex-col gap-4 p-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold tracking-tight text-slate-800">一覧</h2>
        <span class="text-sm text-slate-400">全{totalCount()}件</span>
      </div>

      {/* 検索 */}
      <input
        type="search"
        placeholder="JANコード・名前で検索"
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
        class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />

      <Show when={loading()}>
        <p class="text-center text-base text-slate-400">読み込み中...</p>
      </Show>

      <Show when={!loading() && totalCount() === 0}>
        <p class="py-8 text-center text-base text-slate-400">
          まだデータがありません。<br />スキャンタブで読み取ってください。
        </p>
      </Show>

      <Show when={!loading() && totalCount() > 0 && filtered().length === 0}>
        <p class="py-8 text-center text-base text-slate-400">
          「{query()}」に一致するアイテムはありません。
        </p>
      </Show>

      {/* グループ表示 */}
      <For each={grouped()}>
        {(group) => (
          <div class="flex flex-col gap-2">
            {/* リスト名ヘッダー */}
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {listMap()[group.list.id] ?? group.list.id}
              </span>
              <span class="text-xs text-slate-300">{group.items.length}件</span>
            </div>

            {/* アイテム行 */}
            <div class="flex flex-col gap-1.5">
              <For each={group.items}>
                {(item) => (
                  <div class="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm ring-1 ring-slate-900/5">
                    {/* JAN + 名前 */}
                    <div class="flex-1 min-w-0">
                      <p class="font-mono text-sm font-bold text-slate-800">{item.jan}</p>
                      <Show when={item.name}>
                        <p class="truncate text-xs text-slate-500">{item.name}</p>
                      </Show>
                    </div>

                    {/* 価格 */}
                    <Show when={item.retailPrice !== undefined || item.salePrice !== undefined}>
                      <div class="shrink-0 text-right text-xs text-slate-500">
                        <Show when={item.retailPrice !== undefined}>
                          <p>定価 ¥{item.retailPrice!.toLocaleString()}</p>
                          <p class="text-slate-400">税込 ¥{taxIn(item.retailPrice!).toLocaleString()}</p>
                        </Show>
                        <Show when={item.salePrice !== undefined}>
                          <p>売価 ¥{item.salePrice!.toLocaleString()}</p>
                          <p class="text-slate-400">税込 ¥{taxIn(item.salePrice!).toLocaleString()}</p>
                        </Show>
                      </div>
                    </Show>

                    {/* 削除ボタン */}
                    <button
                      type="button"
                      onClick={() => deleteOne(item.id)}
                      class="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-xl text-slate-300 text-xl leading-none active:scale-95 active:text-red-400 touch-manipulation"
                      aria-label="削除"
                    >
                      ×
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
