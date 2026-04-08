import { createSignal, For, onMount, Show, createMemo } from 'solid-js'
import { type ScannedItem, type JanList, loadAllItems, removeItem, saveItem, taxIn } from '../lib/db'
import { formatDate, isValidJan, parsePriceInput } from '../lib/utils'

function exportCSV(items: ScannedItem[], listMap: Record<string, string>) {
  const headers = ['JAN', '名前', 'リスト', '定価(税抜)', '定価(税込)', '売価(税抜)', '売価(税込)', 'スキャン日時']
  const rows = items.map((i) => [
    i.jan,
    i.name,
    listMap[i.listId] ?? '',
    i.retailPrice ?? '',
    i.retailPrice !== undefined ? taxIn(i.retailPrice) : '',
    i.salePrice ?? '',
    i.salePrice !== undefined ? taxIn(i.salePrice) : '',
    formatDate(i.scannedAt),
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `jan-sync-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ItemList(props: { lists: JanList[] }) {
  const [items, setItems] = createSignal<ScannedItem[]>([])
  const [query, setQuery] = createSignal('')
  const [loading, setLoading] = createSignal(true)
  const [expandedId, setExpandedId] = createSignal<string | null>(null)

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

  const grouped = createMemo(() => {
    const map = new Map<string, ScannedItem[]>()
    for (const item of filtered()) {
      const list = map.get(item.listId) ?? []
      list.push(item)
      map.set(item.listId, list)
    }
    return props.lists
      .map((l) => ({ list: l, items: map.get(l.id) ?? [] }))
      .filter((g) => g.items.length > 0)
  })

  async function deleteOne(id: string) {
    await removeItem(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (expandedId() === id) setExpandedId(null)
  }

  async function updateField(id: string, patch: Partial<ScannedItem>) {
    const updated = items().map((i) => i.id === id ? { ...i, ...patch } : i)
    setItems(updated)
    const target = updated.find((i) => i.id === id)
    if (target) await saveItem(target)
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => prev === id ? null : id)
  }

  return (
    <div class="flex flex-col gap-4 p-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold tracking-tight text-slate-800">一覧</h2>
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-400">全{items().length}件</span>
          <button
            type="button"
            onClick={() => exportCSV(filtered(), listMap())}
            disabled={filtered().length === 0}
            class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm active:bg-slate-50 disabled:opacity-40 touch-manipulation"
          >
            CSV出力
          </button>
        </div>
      </div>

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

      <Show when={!loading() && items().length === 0}>
        <p class="py-8 text-center text-base text-slate-400">
          まだデータがありません。<br />スキャンタブで読み取ってください。
        </p>
      </Show>

      <Show when={!loading() && items().length > 0 && filtered().length === 0}>
        <p class="py-8 text-center text-base text-slate-400">
          「{query()}」に一致するアイテムはありません。
        </p>
      </Show>

      <For each={grouped()}>
        {(group) => (
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {listMap()[group.list.id] ?? group.list.id}
              </span>
              <span class="text-xs text-slate-300">{group.items.length}件</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <For each={group.items}>
                {(item) => (
                  <div class="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 overflow-hidden">
                    {/* 折りたたみ行 */}
                    <div
                      class="flex min-h-14 items-center gap-3 px-3 py-2 cursor-pointer active:bg-slate-50 touch-manipulation"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <div class="flex-1 min-w-0">
                        <p class="font-mono text-sm font-bold text-slate-800">{item.jan}</p>
                        <div class="flex items-center gap-2">
                          <Show when={item.name}>
                            <p class="truncate text-xs text-slate-500">{item.name}</p>
                          </Show>
                          <p class="shrink-0 text-xs text-slate-300">{formatDate(item.scannedAt)}</p>
                        </div>
                      </div>

                      <Show when={item.retailPrice !== undefined || item.salePrice !== undefined}>
                        <div class="shrink-0 text-right text-xs text-slate-500">
                          <Show when={item.retailPrice !== undefined}>
                            <p>定価 ¥{item.retailPrice!.toLocaleString()}</p>
                          </Show>
                          <Show when={item.salePrice !== undefined}>
                            <p>売価 ¥{item.salePrice!.toLocaleString()}</p>
                          </Show>
                        </div>
                      </Show>

                      <span class="shrink-0 text-xs text-slate-300">
                        {expandedId() === item.id ? '▲' : '▼'}
                      </span>
                    </div>

                    {/* 展開編集エリア */}
                    <Show when={expandedId() === item.id}>
                      <div class="border-t border-slate-100 px-3 py-3 flex flex-col gap-2">
                        {/* JAN */}
                        <div class="flex flex-col gap-1">
                          <span class="text-xs text-slate-500">JANコード</span>
                          <input
                            type="text"
                            inputmode="numeric"
                            value={item.jan}
                            onBlur={(e) => {
                              const v = e.currentTarget.value.trim()
                              if (isValidJan(v)) updateField(item.id, { jan: v })
                              else e.currentTarget.value = item.jan
                            }}
                            class="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm font-bold focus:border-blue-400 focus:outline-none"
                            maxLength={13}
                          />
                        </div>

                        {/* 名前 */}
                        <div class="flex flex-col gap-1">
                          <span class="text-xs text-slate-500">名前</span>
                          <input
                            type="text"
                            value={item.name}
                            onBlur={(e) => updateField(item.id, { name: e.currentTarget.value })}
                            placeholder="名前を入力..."
                            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                          />
                        </div>

                        {/* 価格 */}
                        <div class="grid grid-cols-2 gap-2">
                          <div class="flex flex-col gap-1">
                            <span class="text-xs text-slate-500">定価（税抜）</span>
                            <input
                              type="text"
                              inputmode="numeric"
                              value={item.retailPrice ?? ''}
                              onBlur={(e) => updateField(item.id, { retailPrice: parsePriceInput(e.currentTarget.value) })}
                              placeholder="¥0"
                              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                            />
                            <Show when={item.retailPrice !== undefined}>
                              <span class="text-xs text-slate-400">税込 ¥{taxIn(item.retailPrice!).toLocaleString()}</span>
                            </Show>
                          </div>
                          <div class="flex flex-col gap-1">
                            <span class="text-xs text-slate-500">売価（税抜）</span>
                            <input
                              type="text"
                              inputmode="numeric"
                              value={item.salePrice ?? ''}
                              onBlur={(e) => updateField(item.id, { salePrice: parsePriceInput(e.currentTarget.value) })}
                              placeholder="¥0"
                              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                            />
                            <Show when={item.salePrice !== undefined}>
                              <span class="text-xs text-slate-400">税込 ¥{taxIn(item.salePrice!).toLocaleString()}</span>
                            </Show>
                          </div>
                        </div>

                        {/* 削除 */}
                        <button
                          type="button"
                          onClick={() => deleteOne(item.id)}
                          class="w-full rounded-xl border border-rose-200 bg-rose-50 py-2 text-sm font-medium text-rose-600 active:bg-rose-100 touch-manipulation"
                        >
                          削除
                        </button>
                      </div>
                    </Show>
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
